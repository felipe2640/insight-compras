"""Mock de contrato com estado, exclusivo do ensaio G0; não é código do Hub.

Ele resolve rotas e schemas pelo OpenAPI e modela somente os fatos necessários
para provar encadeamento, autorização e erros. Não é desenho de persistência,
motor de corte, servidor de produção ou implementação H0–H7.
"""

from __future__ import annotations

import copy
import base64
import hashlib
import hmac
import json
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import yaml
from jsonschema import Draft202012Validator, RefResolver, ValidationError


SPEC = yaml.safe_load((Path(__file__).parents[3] / "openapi" / "cotacao-hub-v1.yaml").read_text())
RESOLVER = RefResolver.from_schema(SPEC)


def uid():
    return str(uuid.uuid4())


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


class ContractMock:
    def __init__(self):
        self.now = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
        self.tenants = {}
        self.apps = {}
        self.sessions = {}
        self.buyer_sessions = {}
        self.trusted_idp_key = secrets.token_bytes(32)
        self.seen_assertion_jti = set()
        self.allowed_return_url = "https://cliente-terceiro.example/retorno"
        self.supplier_actors = {}
        self.suppliers = {}
        self.quotes = {}
        self.invites = {}
        self.challenges = {}
        self.challenge_requests = {}
        self.runs = {}
        self.orders = {}
        self.documents = {}
        self.document_links = {}
        self.idempotency = {}
        self.events = []
        self.event_cursors = {}
        self.policy_id = uid()
        self.last_otp = None  # test-only observation, never an HTTP response
        self.last_invitation = None  # test-only delivery sink
        self.webhook_secret = secrets.token_bytes(32)
        self.webhook_seen = set()
        self.undeclared_responses = []

    def bootstrap(self, namespace):
        tenant, client, secret = uid(), uid(), secrets.token_urlsafe(24)
        self.tenants[tenant] = {"namespace": namespace}
        self.apps[client] = {"tenant": tenant, "secret": secret, "scopes": {
            "supplier:manage", "quotation:write", "quotation:read", "quotation:manage",
            "invitation:write", "award:read", "award:write", "award:approve",
            "order:read", "order:write", "order:issue", "integration:manage",
            "event:read", "usage:read", "portal:launch"}}
        return {"tenant_id": tenant, "client_id": client, "client_secret": secret}

    def _operation(self, method, path):
        for template, methods in SPEC["paths"].items():
            if method.lower() not in methods:
                continue
            pattern = "^" + re.sub(r"\{([^}]+)\}", r"(?P<\1>[^/]+)", template) + "$"
            match = re.match(pattern, path)
            if match:
                return template, methods[method.lower()], match.groupdict()
        raise AssertionError(f"Operation missing from OpenAPI: {method} {path}")

    def _problem(self, status, code):
        code = {"unauthorized": "invalid_token", "invalid_client": "invalid_token",
                "invalid_signature": "invalid_token", "idempotency_key_required": "invalid_request",
                "quotation_not_draft": "domain_violation", "invalid_transition": "domain_violation",
                "unknown_item": "domain_violation", "award_not_approved": "domain_violation",
                "order_not_issued": "domain_violation"}.get(code, code)
        return status, {"type": "https://cotacao-hub.example/problems/" + code,
                        "title": code, "status": status, "code": code, "request_id": uid()}, {}

    def _check_schema(self, operation, body):
        content = operation.get("requestBody", {}).get("content", {})
        if "application/json" not in content:
            return
        schema = content["application/json"].get("schema", {})
        Draft202012Validator(schema, resolver=RESOLVER).validate(body)

    def _status_declared(self, operation, status):
        if str(status) not in operation.get("responses", {}):
            self.undeclared_responses.append((operation.get("operationId", operation.get("summary")), status))

    def _validate_response(self, operation, status, data):
        response = operation["responses"].get(str(status))
        assert response is not None, (operation["operationId"], status, "undeclared response")
        if "$ref" in response:
            response = SPEC["components"]["responses"][response["$ref"].split("/")[-1]]
        media = "application/problem+json" if status >= 400 else "application/json"
        content = response.get("content", {})
        if not content:
            assert data is None, (operation["operationId"], status, "unexpected response body")
            return
        schema = content[media]["schema"]
        try:
            Draft202012Validator({**schema, "components": SPEC["components"]}).validate(data)
        except ValidationError as error:
            raise AssertionError((operation["operationId"], status, error.message, data)) from error

    def sign_identity_assertion(self, tenant, *, issuer="https://idp.example.test", audience="cotacao-hub",
                                subject="buyer-ana", jti=None):
        claims = {"iss": issuer, "aud": audience, "sub": subject, "tenant": tenant,
                  "jti": jti or uid(), "exp": int((self.now + timedelta(minutes=5)).timestamp())}
        payload = base64.urlsafe_b64encode(canonical(claims)).rstrip(b"=").decode()
        signature = hmac.new(self.trusted_idp_key, payload.encode(), hashlib.sha256).hexdigest()
        return payload + "." + signature

    def call(self, method, target, *, token=None, body=None, key=None, etag=None,
             identity_assertion=None, hub_session=None):
        parsed = urlsplit(target)
        path = parsed.path
        template, operation, params = self._operation(method, path)
        body = {} if body is None else body
        if operation.get("requestBody") and "application/json" in operation["requestBody"].get("content", {}):
            try:
                self._check_schema(operation, body)
            except ValidationError:
                result = self._problem(400, "invalid_request")
                self._status_declared(operation, result[0])
                self._validate_response(operation, result[0], result[1])
                return result
        # The mock accepts only issued test credentials. No tenant or actor is read from body.
        session = self.sessions.get(token)
        if session and (self.now >= session["issued_at"] + timedelta(hours=12) or
                        self.now >= session["last_activity"] + timedelta(minutes=30)):
            result = self._problem(401, "invalid_token")
            self._status_declared(operation, result[0])
            self._validate_response(operation, result[0], result[1])
            return result
        if session:
            session["last_activity"] = self.now
        app = self.apps.get(token)
        actor = session or app or self.buyer_sessions.get(hub_session)
        public = template in {"/api/v1/oauth/token", "/api/v1/supplier/invitations:redeem",
                              "/api/v1/supplier/order-invitations:redeem",
                              "/api/v1/supplier/auth/challenges",
                              "/api/v1/supplier/auth/order-challenges"} or template.endswith("/auth/challenges/{challengeId}:verify")
        if not public and actor is None:
            result = self._problem(401, "unauthorized")
            self._status_declared(operation, result[0])
            self._validate_response(operation, result[0], result[1])
            return result
        if actor and isinstance(body, dict) and body.get("tenant_id") not in (None, actor.get("tenant")):
            result = self._problem(403, "tenant_mismatch")
            self._status_declared(operation, result[0])
            self._validate_response(operation, result[0], result[1])
            return result
        required_scope = []
        for requirement in operation.get("security", []):
            required_scope += requirement.get("bearerAuth", [])
        if app and required_scope and any(s not in app["scopes"] for s in required_scope):
            result = self._problem(403, "insufficient_scope")
            self._status_declared(operation, result[0])
            self._validate_response(operation, result[0], result[1])
            return result
        # Idempotency is scoped by credential, method, path and key.
        idem_slot = None
        if method.upper() in {"POST", "PUT", "PATCH", "DELETE"} and template != "/api/v1/oauth/token":
            if not key:
                result = self._problem(400, "idempotency_key_required")
                self._status_declared(operation, result[0])
                self._validate_response(operation, result[0], result[1])
                return result
            idem_slot = (token or hub_session or "public", method.upper(), path, key)
            digest_input = {"body": body, "identity_assertion": identity_assertion} if template == "/api/v1/sso/launches" else body
            digest = hashlib.sha256(canonical(digest_input)).hexdigest()
            prior = self.idempotency.get(idem_slot)
            if prior:
                if prior[0] != digest:
                    result = self._problem(409, "idempotency_key_conflict")
                    self._status_declared(operation, result[0])
                    self._validate_response(operation, result[0], result[1])
                    return result
                replay = copy.deepcopy(prior[1])
                self._validate_response(operation, replay[0], replay[1])
                return replay
        self._identity_assertion = identity_assertion
        self._hub_session = hub_session
        result = self._dispatch(template, method.upper(), params, actor, body, etag, parse_qs(parsed.query))
        self._status_declared(operation, result[0])
        self._validate_response(operation, result[0], result[1])
        if idem_slot and result[0] < 500:
            self.idempotency[idem_slot] = (digest, copy.deepcopy(result))
        return result

    def _version(self, resource, etag):
        if etag is None:
            return self._problem(428, "precondition_required")
        if etag != f'"v{resource["version"]}"':
            return self._problem(412, "version_conflict")
        return None

    def _ok(self, status, data, resource=None):
        return status, data, ({"ETag": f'"v{resource["version"]}"'} if resource else {})

    def _quotation_view(self, q):
        source = q["source"]
        return {"id": q["id"], "status": q["status"], "version": q["version"],
                "revision": q["revision"], "currency": source["currency"],
                "response_deadline_at": source["response_deadline_at"],
                "buyer_snapshot": source["buyer_snapshot"],
                "destinations": source["destinations"], "items": copy.deepcopy(q["items"]),
                "external_refs": [{"source_system": source["source_system"],
                                   "external_id": source["external_id"]}]}

    def _offer_view(self, q):
        offer = q["offer"]
        items = []
        for line in offer["lines"]:
            requested = next(i for i in q["items"] if i["id"] == line["quotation_item_id"])
            items.append({**line, "requested_reference": requested.get("requested_reference"),
                          "requested_brand": requested.get("requested_brand"),
                          "requested_quantity": requested["requested_quantity"],
                          "requested_unit": requested["requested_unit"]})
        result = {"supplier_id": q["supplier_id"], "status": "submitted" if offer["submitted"] else "draft",
                  "version": offer["version"], "origin": "authenticated_supplier", "items": items}
        if offer["terms"]: result["terms"] = offer["terms"]
        return result

    def _policy_view(self):
        return {"id": self.policy_id, "version": "1", "strategy_id": "lowest_unit_price",
                "strategy_version": "1", "minimum_order_mode": "warning",
                "assisted_response_mode": "exclude", "brand_policy": "allow_review",
                "allow_overbuy": False, "rounding": "HALF_UP"}

    def _run_view(self, run):
        q = self.quotes[run["quotation_id"]]
        first = q["items"][0]
        allocation = {"id": run["allocation_id"], "quotation_item_id": first["id"],
                      "supplier_id": q["supplier_id"], "allocated_quantity": first["requested_quantity"],
                      "acquisition_quantity": first["requested_quantity"], "unit_price": "10.500000",
                      "goods_cost": "73.500000", "comparison_status": "comparable", "reason_codes": []}
        scenario = {"supplier_id": q["supplier_id"], "destination_external_id": first["destination_external_id"],
                    "currency": q["source"]["currency"], "allocations": [allocation],
                    "goods_subtotal": "73.500000", "minimum_order_mode": "warning",
                    "minimum_order_amount": "0.000000", "minimum_status": "met",
                    "freight_status": "known", "freight_mode": "CIF", "freight_known_amount": "0.000000",
                    "commercial_known_total": "73.500000", "comparison_status": "comparable",
                    "scenario_feasibility": "warning", "violations": [], "alerts": ["brand_substitution"],
                    "non_comparable_fields": []}
        return {"id": run["id"], "quotation_id": q["id"], "status": run["status"],
                "version": run["version"], "input_hash": run["input_hash"],
                "result_hash": run["result_hash"], "input_schema_version": "1",
                "policy": self._policy_view(), "strategy_artifact_digest": run["input_hash"],
                "item_comparisons": [{"quotation_item_id": first["id"], "comparison_status": "comparable",
                                      "lowest_unit_price": "10.500000", "line_eligibility": "eligible"}],
                "candidates": [{"quotation_item_id": first["id"], "supplier_id": q["supplier_id"],
                                "eligibility_status": "eligible", "reason_codes": []}],
                "allocations": [allocation], "pending_items": [],
                "supplier_destination_scenarios": [scenario],
                "suggested_award": {"strategy_id": "lowest_unit_price", "strategy_version": "1",
                                    "allocation_ids": [allocation["id"]], "scenario_feasibility": "warning",
                                    "reason_codes": ["brand_substitution"]},
                "alerts": [{"code": "brand_substitution", "message": "Marca alternativa"}],
                "rules_applied": ["brand_policy"], "rules_ignored": []}

    def _order_view(self, order):
        q = self.quotes[order["quotation_id"]]
        first = q["items"][0]
        line = next((i for i in q["offer"]["lines"] if i["quotation_item_id"] == first["id"]), {})
        return {"id": order["id"], "number": order["number"], "status": order["status"],
                "version": order["version"], "quotation_id": q["id"], "award_run_id": order["run_id"],
                "buyer_snapshot": q["source"]["buyer_snapshot"],
                "supplier_snapshot": {"id": order["supplier_id"], "legal_name": self.suppliers[order["supplier_id"]]["legal_name"]},
                "destination": q["source"]["destinations"][0], "currency": q["source"]["currency"],
                "items": [{"quotation_item_id": first["id"], "requested_reference": first.get("requested_reference"),
                           "offered_reference": line.get("offered_reference"), "requested_brand": first.get("requested_brand"),
                           "offered_brand": line.get("offered_brand"), "ordered_quantity": first["requested_quantity"],
                           "unit": first["requested_unit"], "unit_price": "10.500000", "line_total": "73.500000"}],
                "goods_total": "73.500000", "freight_total": "0.000000", "total": "73.500000",
                "commercial_terms": q["offer"]["terms"]}

    def _quote(self, quote_id, actor):
        q = self.quotes.get(quote_id)
        if not q or not actor or actor.get("tenant") != q["tenant"]:
            return None
        return q

    def _supplier_access(self, q, actor):
        return actor and actor.get("kind") == "supplier" and actor.get("quotation_id") == q["id"] and actor.get("supplier_id") == q.get("supplier_id")

    def _event(self, typ, tenant, aggregate, data):
        event = {"event_id": uid(), "event_type": typ, "schema_version": "1", "tenant_id": tenant,
                 "occurred_at": iso(self.now), "correlation_id": uid(),
                 "aggregate": {"type": "purchase_order", "id": aggregate, "version": self.orders[aggregate]["version"]},
                 "payload": data}
        self.events.append(event)
        return event

    def _dispatch(self, template, method, p, actor, b, etag, query):
        if template == "/api/v1/sso/launches":
            if b.get("return_url") != self.allowed_return_url:
                return self._problem(400, "invalid_request")
            q = self.quotes.get(b["quotation_id"])
            if not q or q["tenant"] != actor.get("tenant"):
                return self._problem(404, "resource_not_found")
            if self._hub_session:
                if self._hub_session not in self.buyer_sessions:
                    return self._problem(401, "invalid_token")
            else:
                assertion = self._identity_assertion
                if not assertion or "." not in assertion:
                    return self._problem(401, "invalid_token")
                payload, signature = assertion.rsplit(".", 1)
                expected = hmac.new(self.trusted_idp_key, payload.encode(), hashlib.sha256).hexdigest()
                if not hmac.compare_digest(expected, signature):
                    return self._problem(401, "invalid_token")
                try:
                    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
                except (ValueError, json.JSONDecodeError):
                    return self._problem(401, "invalid_token")
                if claims.get("iss") != "https://idp.example.test" or claims.get("aud") != "cotacao-hub" or \
                   claims.get("exp", 0) <= int(self.now.timestamp()) or not claims.get("sub") or not claims.get("jti"):
                    return self._problem(401, "invalid_token")
                if claims.get("tenant") != actor["tenant"]:
                    return self._problem(403, "tenant_mismatch")
                if claims["jti"] in self.seen_assertion_jti:
                    return self._problem(409, "idempotency_key_conflict")
                self.seen_assertion_jti.add(claims["jti"])
            return self._ok(201, {"launch_url": "https://portal.cotacao-hub.example/launch/" + secrets.token_urlsafe(32),
                                  "expires_at": iso(self.now + timedelta(minutes=2))})
        if template == "/api/v1/oauth/token":
            app = self.apps.get(b.get("client_id"))
            if not app or app["secret"] != b.get("client_secret"):
                return self._problem(401, "invalid_client")
            return self._ok(200, {"access_token": b["client_id"], "token_type": "Bearer", "expires_in": 900,
                                  "scope": " ".join(sorted(app["scopes"]))})
        if template == "/api/v1/suppliers" and method == "POST":
            sid = uid()
            self.suppliers[sid] = {"id": sid, "tenant": actor["tenant"], "version": 1, "legal_name": b["legal_name"],
                                   "contacts": b["contacts"], "status": "active"}
            return self._ok(201, {"id": sid, "legal_name": b["legal_name"], "contacts": b["contacts"],
                                  "status": "active", "version": 1}, self.suppliers[sid])
        if template == "/api/v1/quotations" and method == "POST":
            qid = uid()
            q = {"id": qid, "tenant": actor["tenant"], "status": "draft", "version": 1,
                 "items": [], "source": copy.deepcopy(b), "revision": 1,
                 "offer": {"version": 1, "lines": [], "terms": None, "submitted": False},
                 "supplier_id": None, "run_id": None, "orders": [], "external_id": b.get("external_id")}
            for item in b.get("items", []):
                q["items"].append({**item, "id": uid()})
            self.quotes[qid] = q
            return self._ok(201, self._quotation_view(q), q)
        if template == "/api/v1/quotations/{quotationId}" and method == "GET":
            q = self._quote(p["quotationId"], actor)
            if not q:
                return self._problem(404, "resource_not_found")
            return self._ok(200, self._quotation_view(q), q)
        if template.startswith("/api/v1/quotations/{quotationId}") and not template.endswith("/award-runs"):
            q = self._quote(p["quotationId"], actor)
            if not q:
                return self._problem(404, "resource_not_found")
            if template.endswith("/items:bulk"):
                bad = self._version(q, etag)
                if bad: return bad
                if q["status"] != "draft": return self._problem(409, "quotation_not_draft")
                for item in b.get("items", []): q["items"].append({**item, "id": uid()})
                q["version"] += 1
                return self._ok(200, self._quotation_view(q), q)
            if template.endswith(":open"):
                bad = self._version(q, etag)
                if bad: return bad
                if q["status"] != "draft": return self._problem(409, "invalid_transition")
                q["status"] = "open"; q["version"] += 1
                return self._ok(200, self._quotation_view(q), q)
            if template.endswith("/invitations"):
                bad = self._version(q, etag)
                if bad: return bad
                if q["status"] != "open": return self._problem(409, "quotation_closed")
                sid = b.get("supplier_id")
                if sid not in self.suppliers or self.suppliers[sid]["tenant"] != q["tenant"]:
                    return self._problem(404, "resource_not_found")
                q["supplier_id"] = sid
                token = secrets.token_urlsafe(32)
                self.invites[token] = {"quotation_id": q["id"], "supplier_id": sid, "tenant": q["tenant"],
                                       "recipient_email": b["recipients"][0]["email"].strip().lower(),
                                       "expires": self.now + timedelta(hours=24), "revoked": False, "used": False, "kind": "quotation"}
                self.last_invitation = token
                q["version"] += 1
                return self._ok(201, {"invitation_ids": [uid()], "delivery_status": "manual", "manual_links": [token]}, q)
            if template.endswith(":close"):
                bad = self._version(q, etag)
                if bad: return bad
                if q["status"] != "open": return self._problem(409, "invalid_transition")
                q["status"] = "closed_for_responses"; q["version"] += 1
                return self._ok(200, self._quotation_view(q), q)
            if template.endswith(":reopen"):
                bad = self._version(q, etag)
                if bad: return bad
                if any(self.orders[oid]["status"] != "draft" for oid in q["orders"]):
                    return self._problem(409, "quotation_has_issued_orders")
                for oid in q["orders"]:
                    self.orders[oid]["status"] = "cancelled"
                    self.orders[oid]["version"] += 1
                if q["run_id"]: self.runs[q["run_id"]]["status"] = "superseded"
                q["status"] = "open"; q["version"] += 1
                return self._ok(200, self._quotation_view(q), q)
        if template == "/api/v1/supplier/invitations:redeem":
            inv = self.invites.get(b.get("token"))
            if not inv: return self._problem(404, "resource_not_found")
            if inv["revoked"]: return self._problem(410, "invitation_revoked")
            if self.now >= inv["expires"]: return self._problem(410, "invitation_expired")
            if inv["used"]: return self._problem(410, "invitation_replayed")
            inv["used"] = True
            ctx = uid(); inv["context"] = ctx
            return self._ok(200, {"challenge_context_id": ctx, "quotation_id": inv["quotation_id"],
                                  "supplier_id": inv["supplier_id"], "permitted_channel": "email"})
        if template in {"/api/v1/supplier/auth/challenges", "/api/v1/supplier/auth/order-challenges"}:
            ctx = b.get("challenge_context_id") or b.get("order_invitation_context_id")
            inv = next((v for v in self.invites.values() if v.get("context") == ctx), None)
            if not inv: return self._problem(404, "resource_not_found")
            recent = [t for t in self.challenge_requests.get(ctx, []) if self.now - t < timedelta(hours=1)]
            if len(recent) >= 5 or (recent and self.now - recent[-1] < timedelta(seconds=60)):
                return self._problem(429, "rate_limited")
            self.challenge_requests[ctx] = recent + [self.now]
            cid, code = uid(), str(secrets.randbelow(900000) + 100000)
            self.challenges[cid] = {"code": code, "inv": inv, "expires": self.now + timedelta(minutes=5), "attempts": 0}
            self.last_otp = code
            return self._ok(202, {"challenge_id": cid, "expires_at": iso(self.challenges[cid]["expires"])})
        if template == "/api/v1/supplier/auth/challenges/{challengeId}:verify":
            ch = self.challenges.get(p["challengeId"])
            if not ch: return self._problem(404, "resource_not_found")
            if self.now >= ch["expires"]: return self._problem(410, "expired_otp")
            if ch["attempts"] >= 5: return self._problem(429, "rate_limited")
            ch["attempts"] += 1
            if b.get("code") != ch["code"]: return self._problem(401, "invalid_otp")
            inv = ch["inv"]
            token = secrets.token_urlsafe(32)
            identity_key = (inv["supplier_id"], inv["recipient_email"])
            actor_id = self.supplier_actors.setdefault(identity_key, uid())
            permissions = ({"order:read", "order:respond"} if inv.get("order_id") else
                           {"offer:read", "offer:write", "offer:submit"})
            self.sessions[token] = {"kind": "supplier", "tenant": inv["tenant"],
                                    "supplier_id": inv["supplier_id"], "quotation_id": inv.get("quotation_id"),
                                    "order_id": inv.get("order_id"), "actor_id": actor_id, "scopes": permissions,
                                    "issued_at": self.now, "last_activity": self.now}
            return self._ok(200, {"access_token": token, "actor_id": self.sessions[token]["actor_id"],
                                   "supplier_id": inv["supplier_id"],
                                   **({"quotation_id": inv["quotation_id"]} if inv.get("quotation_id") else {}),
                                   **({"order_id": inv["order_id"]} if inv.get("order_id") else {}),
                                   "permissions": sorted(permissions),
                                   "expires_at": iso(self.now + timedelta(minutes=30))})
        if template == "/api/v1/supplier/quotations/{quotationId}" and method == "GET":
            q = self.quotes.get(p["quotationId"])
            if not q or not self._supplier_access(q, actor): return self._problem(404, "resource_not_found")
            return self._ok(200, {"quotation": self._quotation_view(q), "offer": self._offer_view(q)}, q["offer"])
        if template.startswith("/api/v1/supplier/quotations/{quotationId}"):
            q = self.quotes.get(p["quotationId"])
            if not q or not self._supplier_access(q, actor): return self._problem(404, "resource_not_found")
            offer = q["offer"]
            bad = self._version(offer, etag)
            if bad: return bad
            if q["status"] != "open": return self._problem(409, "quotation_closed")
            if template.endswith("/offer-items:bulk"):
                for item in b.get("items", []):
                    if item.get("supplier_id") not in (None, actor["supplier_id"]):
                        return self._problem(403, "supplier_mismatch")
                    if item.get("quotation_item_id") not in {i["id"] for i in q["items"]}:
                        return self._problem(422, "unknown_item")
                offer["lines"] = b["items"]; offer["version"] += 1
                return self._ok(200, self._offer_view(q), offer)
            if template.endswith("/offer"):
                offer["terms"] = b; offer["version"] += 1
                return self._ok(200, self._offer_view(q), offer)
            if template.endswith(":submit"):
                offer["submitted"] = True; offer["version"] += 1
                return self._ok(200, {"submitted_revision_id": uid(), "submitted_at": iso(self.now),
                                      "pending_item_ids": [i["id"] for i in q["items"] if i["id"] not in {x.get("quotation_item_id") for x in offer["lines"]}],
                                      "offer": self._offer_view(q)}, offer)
        if template == "/api/v1/award-policies":
            return self._ok(200, {"data": [self._policy_view()]})
        if template == "/api/v1/quotations/{quotationId}/award-runs":
            q = self._quote(p["quotationId"], actor)
            if not q: return self._problem(404, "resource_not_found")
            bad = self._version(q, etag)
            if bad: return bad
            if q["status"] != "closed_for_responses": return self._problem(409, "invalid_transition")
            rid = uid()
            snap = {"quotation_id": q["id"], "quotation_version": q["version"], "items": q["items"],
                    "offer": q["offer"], "policy": b}
            run = {"id": rid, "quotation_id": q["id"], "tenant": q["tenant"], "status": "computed", "version": 1,
                   "snapshot": snap, "input_hash": hashlib.sha256(canonical(snap)).hexdigest(),
                   "result_hash": hashlib.sha256(canonical({"award": snap})).hexdigest(),
                   "allocation_id": uid()}
            self.runs[rid] = run; q["run_id"] = rid
            return self._ok(201, self._run_view(run), run)
        if template == "/api/v1/award-runs/{awardRunId}" and method == "GET":
            run = self.runs.get(p["awardRunId"])
            if not run or not actor or run["tenant"] != actor.get("tenant"): return self._problem(404, "resource_not_found")
            return self._ok(200, self._run_view(run), run)
        if template == "/api/v1/award-runs/{awardRunId}/snapshot":
            run = self.runs.get(p["awardRunId"])
            if not run or not actor or run["tenant"] != actor.get("tenant"): return self._problem(404, "resource_not_found")
            return self._ok(200, {"award_run_id": run["id"], "schema_version": "1", "canonicalization": "RFC8785",
                                  "input_hash": run["input_hash"], "strategy_id": "lowest_unit_price",
                                  "strategy_version": "1", "strategy_artifact_digest": run["input_hash"],
                                  "captured_at": iso(self.now), "input": run["snapshot"]})
        if template.startswith("/api/v1/award-runs/{awardRunId}"):
            run = self.runs.get(p["awardRunId"])
            if not run or not actor or run["tenant"] != actor.get("tenant"): return self._problem(404, "resource_not_found")
            bad = self._version(run, etag)
            if bad: return bad
            if template.endswith(":adjust"):
                rid = uid(); child = {**run, "id": rid, "version": 1, "status": "computed", "parent_run_id": run["id"]}
                self.runs[rid] = child; self.quotes[run["quotation_id"]]["run_id"] = rid
                return self._ok(201, {**self._run_view(child), "parent_run_id": run["id"]}, child)
            if template.endswith(":approve"):
                if run["status"] != "computed": return self._problem(409, "invalid_transition")
                run["status"] = "approved"; run["version"] += 1
                return self._ok(200, self._run_view(run), run)
            if template.endswith("/purchase-orders"):
                if run["status"] != "approved": return self._problem(409, "award_not_approved")
                q = self.quotes[run["quotation_id"]]
                oid = uid(); order = {"id": oid, "tenant": q["tenant"], "supplier_id": q["supplier_id"],
                                      "quotation_id": q["id"], "run_id": run["id"], "status": "draft", "version": 1,
                                      "number": "PO-2026-" + oid[:8]}
                self.orders[oid] = order; q["orders"].append(oid)
                self._event("purchase_order.created.v1", q["tenant"], oid,
                            {"order_id": oid, "quotation_id": q["id"], "supplier_id": q["supplier_id"], "order_status": "draft"})
                return self._ok(201, {"orders": [self._order_view(order)]}, run)
        if template == "/api/v1/purchase-orders/{orderId}" and method == "GET":
            order = self.orders.get(p["orderId"])
            if not order or not actor or actor.get("tenant") != order["tenant"]: return self._problem(404, "resource_not_found")
            return self._ok(200, self._order_view(order), order)
        if template.startswith("/api/v1/purchase-orders/{orderId}"):
            order = self.orders.get(p["orderId"])
            if not order or not actor or actor.get("tenant") != order["tenant"]: return self._problem(404, "resource_not_found")
            if template.endswith("/invitations"):
                if order["status"] != "issued": return self._problem(409, "order_not_issued")
                token = secrets.token_urlsafe(32)
                self.invites[token] = {"kind": "order", "order_id": order["id"], "tenant": order["tenant"],
                                       "supplier_id": order["supplier_id"], "expires": self.now + timedelta(hours=24),
                                       "recipient_email": b["recipient"]["email"].strip().lower(),
                                       "revoked": False, "used": False}
                self.last_invitation = token
                return self._ok(201, {"invitation_ids": [uid()], "delivery_status": "manual", "manual_links": [token]})
            bad = self._version(order, etag)
            if bad: return bad
            if template.endswith(":issue"):
                if order["status"] != "draft": return self._problem(409, "duplicate_issue")
                order["status"] = "issued"; order["version"] += 1
                self._event("purchase_order.issued.v1", order["tenant"], order["id"],
                            {"order_id": order["id"], "quotation_id": order["quotation_id"],
                             "supplier_id": order["supplier_id"], "currency": self.quotes[order["quotation_id"]]["source"]["currency"],
                             "total": "73.500000", "issued_at": iso(self.now)})
                did = uid(); self.documents[did] = {"id": did, "tenant": order["tenant"], "order_id": order["id"], "supplier_id": order["supplier_id"]}
                order["document_id"] = did
                return self._ok(200, {**self._order_view(order), "document_id": did}, order)
            if method == "PATCH":
                if order["status"] != "draft": return self._problem(409, "invalid_transition")
                order["version"] += 1
                return self._ok(200, self._order_view(order), order)
        if template == "/api/v1/supplier/order-invitations:redeem":
            inv = self.invites.get(b.get("token"))
            if not inv or inv["kind"] != "order": return self._problem(404, "resource_not_found")
            if inv["revoked"]: return self._problem(410, "invitation_revoked")
            if self.now >= inv["expires"]: return self._problem(410, "invitation_expired")
            if inv["used"]: return self._problem(410, "invitation_replayed")
            inv["used"] = True; inv["context"] = uid()
            return self._ok(200, {"order_invitation_context_id": inv["context"], "order_id": inv["order_id"],
                                  "supplier_id": inv["supplier_id"], "permitted_channel": "email"})
        if template == "/api/v1/supplier/purchase-orders/{orderId}" and method == "GET":
            order = self.orders.get(p["orderId"])
            if not order or not actor or actor.get("order_id") != order["id"] or actor.get("supplier_id") != order["supplier_id"]:
                return self._problem(404, "resource_not_found")
            return self._ok(200, self._order_view(order), order)
        if template == "/api/v1/supplier/purchase-orders/{orderId}:confirm":
            order = self.orders.get(p["orderId"])
            if not order or not actor or actor.get("order_id") != order["id"] or actor.get("supplier_id") != order["supplier_id"]:
                return self._problem(404, "resource_not_found")
            bad = self._version(order, etag)
            if bad: return bad
            if order["status"] != "issued": return self._problem(409, "invalid_transition")
            order["status"] = "confirmed"; order["version"] += 1
            self._event("purchase_order.confirmed.v1", order["tenant"], order["id"],
                        {"order_id": order["id"], "supplier_id": order["supplier_id"], "confirmed_at": iso(self.now)})
            return self._ok(200, self._order_view(order), order)
        if template == "/api/v1/documents/{documentId}" and method == "GET":
            doc = self.documents.get(p["documentId"])
            if not doc or not actor or not (actor.get("tenant") == doc["tenant"] and
                ("scopes" in actor and "order:read" in actor["scopes"] or actor.get("order_id") == doc["order_id"])):
                return self._problem(404, "resource_not_found")
            capability = secrets.token_urlsafe(32)
            self.document_links[capability] = {"document_id": doc["id"], "actor": actor,
                                                "expires": self.now + timedelta(minutes=5)}
            return self._ok(200, {"id": doc["id"], "order_id": doc["order_id"], "format": "pdf", "status": "final",
                                  "sha256": hashlib.sha256(doc["id"].encode()).hexdigest(),
                                  "template_version": "1", "download_url": "https://files.example.test/" + doc["id"] + "?cap=" + capability,
                                  "expires_at": iso(self.now + timedelta(minutes=5))})
        if template == "/api/v1/events" and method == "GET":
            event_type = query.get("type", [None])[0]
            cursor = query.get("cursor", [None])[0]
            start = 0
            if cursor:
                saved = self.event_cursors.get(cursor)
                if not saved or saved["tenant"] != actor.get("tenant") or saved["type"] != event_type:
                    return self._problem(404, "resource_not_found")
                start = saved["offset"]
            filtered = [e for e in self.events if actor and e["tenant_id"] == actor.get("tenant") and
                        (event_type is None or e["event_type"] == event_type)]
            limit = int(query.get("limit", [50])[0])
            chunk = filtered[start:start + limit]
            next_cursor = None
            if start + limit < len(filtered):
                next_cursor = secrets.token_urlsafe(24)
                self.event_cursors[next_cursor] = {"tenant": actor["tenant"], "type": event_type,
                                                    "offset": start + limit}
            return self._ok(200, {"data": chunk, "next_cursor": next_cursor})
        raise AssertionError(f"Contract mock lacks dispatch for {method} {template}")

    def use_document_url(self, url, token):
        parsed = urlsplit(url)
        capability = parse_qs(parsed.query).get("cap", [None])[0]
        grant = self.document_links.get(capability)
        actor = self.sessions.get(token) or self.apps.get(token)
        if not grant or not actor or actor is not grant["actor"] or parsed.path != "/" + grant["document_id"]:
            return self._problem(404, "resource_not_found")
        if self.now >= grant["expires"]:
            return self._problem(410, "document_url_expired")
        return self._ok(200, b"synthetic document bytes")

    def sign_webhook(self, event):
        timestamp = str(int(self.now.timestamp()))
        body = canonical(event)
        signature = hmac.new(self.webhook_secret, timestamp.encode() + b"." + event["event_id"].encode() + b"." + body, hashlib.sha256).hexdigest()
        return timestamp, body, signature

    def receive_webhook(self, timestamp, body, signature):
        event = json.loads(body)
        if abs(int(self.now.timestamp()) - int(timestamp)) > 300 or event["event_id"] in self.webhook_seen:
            return self._problem(409, "webhook_replay")
        expected = hmac.new(self.webhook_secret, timestamp.encode() + b"." + event["event_id"].encode() + b"." + body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature): return self._problem(401, "invalid_signature")
        self.webhook_seen.add(event["event_id"])
        return self._ok(204, None)
