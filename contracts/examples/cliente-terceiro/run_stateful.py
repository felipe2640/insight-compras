"""Ensaio G0 encadeado contra stateful_mock, sem implementação de produto."""

from __future__ import annotations

import copy
import json
from datetime import timedelta
from pathlib import Path

from run_mock import sample
from stateful_mock import ContractMock, SPEC, uid


m = ContractMock()
results = []


def body_for(path, method="post"):
    operation = SPEC["paths"][path][method]
    content = operation.get("requestBody", {}).get("content", {})
    return sample(content["application/json"]["schema"]) if "application/json" in content else {}


def call(label, method, path, *, token=None, body=None, etag=None, key=None, expected=None, code=None,
         identity_assertion=None, hub_session=None):
    if key is None and method.lower() not in {"get"} and path != "/api/v1/oauth/token":
        key = uid()
    result = m.call(method, path, token=token, body=body, key=key, etag=etag,
                    identity_assertion=identity_assertion, hub_session=hub_session)
    status, data, headers = result
    if expected is not None:
        assert status == expected, (label, status, data, expected)
    else:
        assert 200 <= status < 300, (label, status, data)
    if code:
        assert data["code"] == code, (label, data)
    results.append({"case": label, "status": status, "code": data.get("code") if isinstance(data, dict) else None})
    return result


def etag(result):
    return result[2]["ETag"]


# Positive chain: no IDs, tokens or ETags are predetermined.
t1 = m.bootstrap("cliente-terceiro")
t2 = m.bootstrap("cliente-terceiro")
assert t1["tenant_id"] != t2["tenant_id"]
results.extend([{"case": "bootstrap T1", "status": 201}, {"case": "bootstrap T2", "status": 201}])
a1 = call("authenticate A1", "post", "/api/v1/oauth/token", body={"client_id": t1["client_id"], "client_secret": t1["client_secret"]})[1]["access_token"]
a2 = call("authenticate A2", "post", "/api/v1/oauth/token", body={"client_id": t2["client_id"], "client_secret": t2["client_secret"]})[1]["access_token"]

supplier_body = {"legal_name": "Distribuidora Aurora Exemplo", "contacts": [{"name": "Ana", "email": "ana@example.test"}]}
supplier = call("create supplier", "post", "/api/v1/suppliers", token=a1, body=supplier_body)
sid = supplier[1]["id"]

quote_body = body_for("/api/v1/quotations")
quote_body.update({"source_system": "cliente-terceiro", "external_id": "opaque-" + uid(), "currency": "BRL",
                   "response_deadline_at": "2026-10-05T18:00:00Z", "items": [{"external_id": "item-1", "description": "Bucha sintética",
                   "requested_reference": "REF-X", "requested_brand": "MARCA-X", "requested_quantity": "7.000000",
                   "requested_unit": "peça", "destination_external_id": "LOJA-A"}]})
qresp = call("create quotation", "post", "/api/v1/quotations", token=a1, body=quote_body)
qid, item1, qtag = qresp[1]["id"], qresp[1]["items"][0]["id"], etag(qresp)
launch_body = {"quotation_id": qid, "return_url": m.allowed_return_url}
assertion = m.sign_identity_assertion(t1["tenant_id"])
call("SSO trusted assertion launch", "post", "/api/v1/sso/launches", token=a1,
     identity_assertion=assertion, body=launch_body)
call("SSO assertion replay", "post", "/api/v1/sso/launches", token=a1,
     identity_assertion=assertion, body=launch_body, expected=409, code="idempotency_key_conflict")
call("SSO issuer rejected", "post", "/api/v1/sso/launches", token=a1,
     identity_assertion=m.sign_identity_assertion(t1["tenant_id"], issuer="https://evil.example.test"),
     body=launch_body, expected=401, code="invalid_token")
call("SSO audience rejected", "post", "/api/v1/sso/launches", token=a1,
     identity_assertion=m.sign_identity_assertion(t1["tenant_id"], audience="other-service"),
     body=launch_body, expected=401, code="invalid_token")
call("SSO tenant mismatch", "post", "/api/v1/sso/launches", token=a1,
     identity_assertion=m.sign_identity_assertion(t2["tenant_id"]),
     body=launch_body, expected=403, code="tenant_mismatch")
call("SSO callback rejected", "post", "/api/v1/sso/launches", token=a1,
     identity_assertion=m.sign_identity_assertion(t1["tenant_id"]),
     body={"quotation_id": qid, "return_url": "https://evil.example.test/steal"},
     expected=400, code="invalid_request")
buyer_cookie = uid()
m.buyer_sessions[buyer_cookie] = {"tenant": t1["tenant_id"], "actor_id": uid(), "kind": "buyer"}
call("SSO Hub buyer session launch", "post", "/api/v1/sso/launches", hub_session=buyer_cookie,
     body=launch_body)

bulk = {"mode": "append", "items": [{"external_id": "item-2", "description": "Pivô sintético", "requested_quantity": "3.000000",
                                   "requested_unit": "peça", "destination_external_id": "LOJA-A"}]}
bresp = call("add items", "post", f"/api/v1/quotations/{qid}/items:bulk", token=a1, body=bulk, etag=qtag)
item2, qtag = bresp[1]["items"][1]["id"], etag(bresp)
opened = call("open", "post", f"/api/v1/quotations/{qid}:open", token=a1, etag=qtag)
qtag = etag(opened)
invite_body = {"supplier_id": sid, "recipients": [{"name": "Ana", "email": "ana@example.test"}],
               "delivery_mode": "manual", "expires_at": "2026-10-02T12:00:00Z"}
invited = call("invite", "post", f"/api/v1/quotations/{qid}/invitations", token=a1, body=invite_body, etag=qtag)
qtag = etag(invited)
invite_token = invited[1]["manual_links"][0]
redeemed = call("redeem quotation invitation", "post", "/api/v1/supplier/invitations:redeem", body={"token": invite_token})
ctx = redeemed[1]["challenge_context_id"]
challenge = call("create OTP", "post", "/api/v1/supplier/auth/challenges", body={"challenge_context_id": ctx, "channel": "email"})
challenge_id = challenge[1]["challenge_id"]
supplier_identity = call("verify OTP", "post", f"/api/v1/supplier/auth/challenges/{challenge_id}:verify",
                         body={"code": m.last_otp})[1]
supplier_session = supplier_identity["access_token"]
assert set(supplier_identity["permissions"]) == {"offer:read", "offer:write", "offer:submit"}
sq = call("read supplier quotation", "get", f"/api/v1/supplier/quotations/{qid}", token=supplier_session)
offer_tag = etag(sq)

line = {"quotation_item_id": item1, "offered_reference": "REF-Y", "offered_brand": "MARCA-Y",
        "substitution_type": "both", "substitution_note": "Alternativa sujeita a aceite",
        "available_quantity": "10.000000", "unit_price": "10.500000", "sales_unit": "peça",
        "minimum_quantity": "1.000000", "sales_multiple": "1.000000", "lead_time_days": 3,
        "no_stock": False, "price_basis": {"currency": "BRL", "priced_unit": "peça", "tax_status": "included",
                                          "freight_status": "included", "discounts_applied": "yes"}}
saved = call("bulk offer", "put", f"/api/v1/supplier/quotations/{qid}/offer-items:bulk",
             token=supplier_session, body={"items": [line]}, etag=offer_tag)
offer_tag = etag(saved)
terms = {"currency": "BRL", "payment_terms": {"description": "28 dias"}, "minimum_order_amount": "0.000000",
         "minimum_scope": "per_order", "freight_terms": {"mode": "CIF", "payer": "supplier"},
         "default_lead_time_days": 3, "offer_valid_until": "2026-10-20T18:00:00Z"}
saved_terms = call("commercial terms", "put", f"/api/v1/supplier/quotations/{qid}/offer",
                   token=supplier_session, body=terms, etag=offer_tag)
offer_tag = etag(saved_terms)
submitted = call("submit", "post", f"/api/v1/supplier/quotations/{qid}:submit", token=supplier_session, etag=offer_tag)
assert item2 in submitted[1]["pending_item_ids"]
qtag = etag(call("buyer reread", "get", f"/api/v1/quotations/{qid}", token=a1))
closed = call("close", "post", f"/api/v1/quotations/{qid}:close", token=a1, etag=qtag)
qtag = etag(closed)
call("read policy", "get", "/api/v1/award-policies", token=a1)
run_body = {"policy_id": m.policy_id, "policy_version": "1"}
computed = call("calculate award", "post", f"/api/v1/quotations/{qid}/award-runs", token=a1, body=run_body, etag=qtag)
rid, rtag = computed[1]["id"], etag(computed)
assert computed[1]["supplier_destination_scenarios"]
call("evaluate scenario", "get", f"/api/v1/award-runs/{rid}", token=a1)
snap = call("read award snapshot", "get", f"/api/v1/award-runs/{rid}/snapshot", token=a1)[1]
assert snap["input_hash"] == computed[1]["input_hash"]
adjusted = call("manual adjustment", "post", f"/api/v1/award-runs/{rid}:adjust", token=a1,
                body={"adjustments": [{"quotation_item_id": item1, "supplier_id": sid, "allocated_quantity": "7.000000",
                                       "reason": "Equivalência técnica conferida", "acknowledged_impact_codes": ["brand_substitution"]}]}, etag=rtag)
rid2, rtag = adjusted[1]["id"], etag(adjusted)
approved = call("approve", "post", f"/api/v1/award-runs/{rid2}:approve", token=a1,
                body={"acknowledged_alert_codes": ["brand_substitution"]}, etag=rtag)
rtag = etag(approved)
prepared = call("prepare PO", "post", f"/api/v1/award-runs/{rid2}/purchase-orders", token=a1, etag=rtag)
oid = prepared[1]["orders"][0]["id"]
order = call("review PO", "get", f"/api/v1/purchase-orders/{oid}", token=a1)
otag = etag(order)
revised = call("revise PO draft", "patch", f"/api/v1/purchase-orders/{oid}", token=a1,
               body={"delivery_note": "Entrega em horário comercial"}, etag=otag)
otag = etag(revised)
issue_key = uid()
issued = call("issue PO", "post", f"/api/v1/purchase-orders/{oid}:issue", token=a1, etag=otag, key=issue_key)
issue_retry = call("issue timeout retry", "post", f"/api/v1/purchase-orders/{oid}:issue", token=a1, etag=otag, key=issue_key)
assert issue_retry == issued
otag, did = etag(issued), issued[1]["document_id"]
oinv = call("invite order responder", "post", f"/api/v1/purchase-orders/{oid}/invitations", token=a1,
            body={"recipient": {"name": "Ana", "email": "ana@example.test"}, "delivery_mode": "manual",
                  "expires_at": "2026-10-02T12:00:00Z"})
order_token = oinv[1]["manual_links"][0]
oredeem = call("redeem order invitation", "post", "/api/v1/supplier/order-invitations:redeem", body={"token": order_token})
octx = oredeem[1]["order_invitation_context_id"]
ochallenge = call("order OTP", "post", "/api/v1/supplier/auth/order-challenges", body={"order_invitation_context_id": octx})
order_identity = call("verify order OTP", "post", f"/api/v1/supplier/auth/challenges/{ochallenge[1]['challenge_id']}:verify",
                      body={"code": m.last_otp})[1]
osess = order_identity["access_token"]
assert order_identity["actor_id"] == supplier_identity["actor_id"]
assert set(order_identity["permissions"]) == {"order:read", "order:respond"}
call("read supplier order", "get", f"/api/v1/supplier/purchase-orders/{oid}", token=osess)
confirmed = call("confirm order", "post", f"/api/v1/supplier/purchase-orders/{oid}:confirm", token=osess, etag=otag)
assert confirmed[1]["status"] == "confirmed"
events = call("read events", "get", "/api/v1/events", token=a1)[1]["data"]
first_event_page = call("read event cursor page", "get", "/api/v1/events?limit=1", token=a1)[1]
assert first_event_page["next_cursor"]
call("T2 cannot use T1 event cursor", "get", "/api/v1/events?cursor=" + first_event_page["next_cursor"],
     token=a2, expected=404, code="resource_not_found")
second_event_page = call("read next event cursor page", "get", "/api/v1/events?cursor=" + first_event_page["next_cursor"], token=a1)[1]
assert second_event_page["data"]
assert [e["event_type"] for e in events][-2:] == ["purchase_order.issued.v1", "purchase_order.confirmed.v1"]
results.append({"case": "event chain", "status": 200})

# Negative fixture. Each check asserts exact HTTP status and stable problem code.
q2_body = copy.deepcopy(quote_body); q2_body["external_id"] = "opaque-" + uid()
q2 = call("create T2 quote", "post", "/api/v1/quotations", token=a2, body=q2_body)
q2id = q2[1]["id"]
call("A1 cannot read T2", "get", f"/api/v1/quotations/{q2id}", token=a1, expected=404, code="resource_not_found")
call("supplier T1 cannot read T2", "get", f"/api/v1/supplier/quotations/{q2id}", token=supplier_session, expected=404, code="resource_not_found")
call("Q1 invite cannot read Q2", "get", f"/api/v1/supplier/quotations/{q2id}", token=supplier_session, expected=404, code="resource_not_found")

# A second supplier in T1 proves that knowing Q1/PO identifiers does not confer access.
other_supplier = call("create supplier B", "post", "/api/v1/suppliers", token=a1,
                      body={"legal_name": "Fornecedor B Exemplo", "contacts": [{"name": "Bia", "email": "bia@example.test"}]})
sid_b = other_supplier[1]["id"]
q3_body = copy.deepcopy(quote_body); q3_body["external_id"] = "opaque-" + uid()
q3 = call("create Q3", "post", "/api/v1/quotations", token=a1, body=q3_body)
q3id = q3[1]["id"]
q3open = call("open Q3", "post", f"/api/v1/quotations/{q3id}:open", token=a1, etag=etag(q3))
q3invite_body = {"supplier_id": sid_b, "recipients": [{"name": "Bia", "email": "bia@example.test"}],
                 "delivery_mode": "manual", "expires_at": "2026-10-02T12:00:00Z"}
q3invite = call("invite B to Q3", "post", f"/api/v1/quotations/{q3id}/invitations", token=a1,
                body=q3invite_body, etag=etag(q3open))
q3redeem = call("redeem B Q3", "post", "/api/v1/supplier/invitations:redeem",
                body={"token": q3invite[1]["manual_links"][0]})
q3challenge = call("OTP B Q3", "post", "/api/v1/supplier/auth/challenges",
                   body={"challenge_context_id": q3redeem[1]["challenge_context_id"], "channel": "email"})
sess_b = call("verify B Q3", "post", f"/api/v1/supplier/auth/challenges/{q3challenge[1]['challenge_id']}:verify",
              body={"code": m.last_otp})[1]["access_token"]
call("supplier B cannot read Q1", "get", f"/api/v1/supplier/quotations/{qid}", token=sess_b,
     expected=404, code="resource_not_found")
call("supplier B cannot read PO A", "get", f"/api/v1/supplier/purchase-orders/{oid}", token=sess_b,
     expected=404, code="resource_not_found")
q3_offer_tag = etag(call("read Q3 B", "get", f"/api/v1/supplier/quotations/{q3id}", token=sess_b))
tampered = copy.deepcopy(quote_body); tampered["external_id"] = "opaque-" + uid(); tampered["tenant_id"] = t2["tenant_id"]
call("tenant body spoof", "post", "/api/v1/quotations", token=a1, body=tampered, expected=400, code="invalid_request")
bad_line = dict(line); bad_line["supplier_id"] = uid()
bad_line["quotation_item_id"] = q3[1]["items"][0]["id"]
call("supplier body spoof", "put", f"/api/v1/supplier/quotations/{q3id}/offer-items:bulk", token=sess_b,
     body={"items": [bad_line]}, etag=q3_offer_tag, expected=400, code="invalid_request")

# Reopen wins against an unissued draft: award and draft order are superseded atomically.
q3_line = dict(line); q3_line["quotation_item_id"] = q3[1]["items"][0]["id"]
q3_saved = call("B bulk Q3", "put", f"/api/v1/supplier/quotations/{q3id}/offer-items:bulk",
                token=sess_b, body={"items": [q3_line]}, etag=q3_offer_tag)
q3_terms = call("B terms Q3", "put", f"/api/v1/supplier/quotations/{q3id}/offer",
                token=sess_b, body=terms, etag=etag(q3_saved))
call("B submit Q3", "post", f"/api/v1/supplier/quotations/{q3id}:submit", token=sess_b, etag=etag(q3_terms))
q3_closed = call("close Q3", "post", f"/api/v1/quotations/{q3id}:close", token=a1, etag=etag(q3invite))
call("late supplier save after close", "put", f"/api/v1/supplier/quotations/{q3id}/offer-items:bulk",
     token=sess_b, body={"items": [q3_line]}, etag=etag(q3_terms), expected=412, code="version_conflict")
q3_run = call("award Q3", "post", f"/api/v1/quotations/{q3id}/award-runs", token=a1,
              body=run_body, etag=etag(q3_closed))
q3_run_id = q3_run[1]["id"]
q3_approved = call("approve Q3", "post", f"/api/v1/award-runs/{q3_run_id}:approve", token=a1,
                   body={"acknowledged_alert_codes": []}, etag=etag(q3_run))
q3_prepared = call("prepare draft Q3", "post", f"/api/v1/award-runs/{q3_run_id}/purchase-orders", token=a1,
                   etag=etag(q3_approved))
q3_order_id = q3_prepared[1]["orders"][0]["id"]
q3_reopened = call("reopen Q3 with draft", "post", f"/api/v1/quotations/{q3id}:reopen", token=a1,
                   body={"reason": "Nova rodada antes de emitir"}, etag=etag(q3_closed))
assert q3_reopened[1]["status"] == "open"
assert m.orders[q3_order_id]["status"] == "cancelled"
assert m.runs[q3_run_id]["status"] == "superseded"
results.append({"case": "reopen atomically supersedes draft and award", "status": 200})
call("T2 document IDOR", "get", f"/api/v1/documents/{did}", token=a2, expected=404, code="resource_not_found")
document = call("buyer document URL", "get", f"/api/v1/documents/{did}", token=a1)[1]
assert m.use_document_url(document["download_url"], a1)[0] == 200
wrong_actor_url = m.use_document_url(document["download_url"], a2)
assert wrong_actor_url[0] == 404 and wrong_actor_url[1]["code"] == "resource_not_found"
results.append({"case": "document URL different actor", "status": 404, "code": "resource_not_found"})
old_time = m.now
m.now += timedelta(minutes=6)
expired_url = m.use_document_url(document["download_url"], a1)
assert expired_url[0] == 410 and expired_url[1]["code"] == "document_url_expired"
results.append({"case": "document URL expired", "status": 410, "code": "document_url_expired"})
m.now = old_time
call("T2 order IDOR", "get", f"/api/v1/purchase-orders/{oid}", token=a2, expected=404, code="resource_not_found")
call("quotation invite replay", "post", "/api/v1/supplier/invitations:redeem", body={"token": invite_token}, expected=410, code="invitation_replayed")
call("order invite replay", "post", "/api/v1/supplier/order-invitations:redeem", body={"token": order_token}, expected=410, code="invitation_replayed")

call("OTP resend cooldown", "post", "/api/v1/supplier/auth/challenges",
     body={"challenge_context_id": ctx, "channel": "email"}, expected=429, code="rate_limited")
m.now += timedelta(seconds=61)
wrong = call("new OTP for negative", "post", "/api/v1/supplier/auth/challenges", body={"challenge_context_id": ctx, "channel": "email"})
wrong_id = wrong[1]["challenge_id"]
call("wrong OTP", "post", f"/api/v1/supplier/auth/challenges/{wrong_id}:verify", body={"code": "000000"}, expected=401, code="invalid_otp")
for attempt in range(2, 6):
    call(f"wrong OTP attempt {attempt}", "post", f"/api/v1/supplier/auth/challenges/{wrong_id}:verify",
         body={"code": "000000"}, expected=401, code="invalid_otp")
call("OTP attempts exhausted", "post", f"/api/v1/supplier/auth/challenges/{wrong_id}:verify",
     body={"code": m.challenges[wrong_id]["code"]}, expected=429, code="rate_limited")
m.now += timedelta(seconds=61)
expired = call("new expiring OTP", "post", "/api/v1/supplier/auth/challenges", body={"challenge_context_id": ctx, "channel": "email"})
m.challenges[expired[1]["challenge_id"]]["expires"] = m.now - timedelta(seconds=1)
call("expired OTP", "post", f"/api/v1/supplier/auth/challenges/{expired[1]['challenge_id']}:verify",
     body={"code": m.last_otp}, expected=410, code="expired_otp")

for name, modifier, expected_code in [("expired invitation", "expires", "invitation_expired"),
                                       ("revoked invitation", "revoked", "invitation_revoked")]:
    tmp = call("fresh invite " + name, "post", f"/api/v1/quotations/{qid}/invitations", token=a1,
               body=invite_body, etag=etag(call("reread for invite", "get", f"/api/v1/quotations/{qid}", token=a1)),
               expected=409, code="quotation_closed")
    # A separate synthetic invitation record models delivery before the quote closed.
    token = uid(); m.invites[token] = dict(m.invites[invite_token], used=False, revoked=False, expires=m.now + timedelta(hours=1))
    if modifier == "expires": m.invites[token]["expires"] = m.now - timedelta(seconds=1)
    else: m.invites[token]["revoked"] = True
    call(name, "post", "/api/v1/supplier/invitations:redeem", body={"token": token}, expected=410, code=expected_code)

idem_body = copy.deepcopy(quote_body); idem_body["external_id"] = "opaque-" + uid()
idem_key = uid()
first = call("idempotent create", "post", "/api/v1/quotations", token=a1, body=idem_body, key=idem_key)
same = call("same key same payload", "post", "/api/v1/quotations", token=a1, body=idem_body, key=idem_key)
assert same == first
changed = copy.deepcopy(idem_body); changed["external_id"] = "opaque-" + uid()
call("same key different payload", "post", "/api/v1/quotations", token=a1, body=changed, key=idem_key,
     expected=409, code="idempotency_key_conflict")
call("missing If-Match", "post", f"/api/v1/quotations/{first[1]['id']}:open", token=a1, expected=428, code="precondition_required")
call("wrong ETag", "post", f"/api/v1/quotations/{first[1]['id']}:open", token=a1, etag='"v999"', expected=412, code="version_conflict")
call("submit after close", "post", f"/api/v1/supplier/quotations/{qid}:submit", token=supplier_session,
     etag=etag(submitted), expected=409, code="quotation_closed")
call("close stale version", "post", f"/api/v1/quotations/{qid}:close", token=a1, etag='"v1"', expected=412, code="version_conflict")
call("duplicate issue", "post", f"/api/v1/purchase-orders/{oid}:issue", token=a1, etag=etag(confirmed), expected=409, code="duplicate_issue")
call("reopen after issued", "post", f"/api/v1/quotations/{qid}:reopen", token=a1,
     etag=etag(call("reread before reopen", "get", f"/api/v1/quotations/{qid}", token=a1)),
     body={"reason": "Nova rodada de preço"},
     expected=409, code="quotation_has_issued_orders")

event = events[-1]; stamp, payload, sig = m.sign_webhook(event)
tampered = m.receive_webhook(stamp, payload, "0" * len(sig))
assert tampered[0] == 401 and tampered[1]["code"] == "invalid_token"
results.append({"case": "webhook signature tampered", "status": 401, "code": "invalid_token"})
old_stamp = str(int(stamp) - 301)
stale_webhook = m.receive_webhook(old_stamp, payload, sig)
assert stale_webhook[0] == 409 and stale_webhook[1]["code"] == "webhook_replay"
results.append({"case": "webhook timestamp expired", "status": 409, "code": "webhook_replay"})
assert m.receive_webhook(stamp, payload, sig)[0] == 204
replay = m.receive_webhook(stamp, payload, sig)
assert replay[0] == 409 and replay[1]["code"] == "webhook_replay"
results.append({"case": "webhook replay", "status": 409, "code": "webhook_replay"})

restricted = uid(); m.apps[restricted] = {"tenant": t1["tenant_id"], "secret": uid(), "scopes": {"quotation:read"}}
call("missing scope", "post", "/api/v1/suppliers", token=restricted, body=supplier_body, expected=403, code="insufficient_scope")

m.now += timedelta(minutes=31)
call("supplier idle session expired", "get", f"/api/v1/supplier/quotations/{q3id}", token=sess_b,
     expected=401, code="invalid_token")

output = Path(__file__).with_name("stateful-result.json")
output.write_text(json.dumps({"positive_and_negative": results, "count": len(results), "tenant_ids_distinct": True,
                              "quote_ids_distinct": qid != q2id, "issued_event_id": event["event_id"],
                              "undeclared_responses": m.undeclared_responses}, indent=2))
assert not m.undeclared_responses, m.undeclared_responses
print(f"PASS {len(results)} chained and negative contract checks; result: {output.name}")
