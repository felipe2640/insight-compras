"""Auditoria estrutural e semântica do contrato OpenAPI pré-G0."""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, RefResolver
from openapi_spec_validator import validate_spec

ROOT = Path(__file__).parents[1]
SPEC = yaml.safe_load((ROOT / "openapi" / "cotacao-hub-v1.yaml").read_text())
validate_spec(SPEC)
assert SPEC["openapi"].startswith("3.1.")
RESOLVER = RefResolver.from_schema(SPEC)


def resolve(ref):
    node = SPEC
    for part in ref.removeprefix("#/").split("/"):
        node = node[part]
    return node


def refs(node):
    if isinstance(node, dict):
        if "$ref" in node:
            yield node["$ref"]
        for value in node.values():
            yield from refs(value)
    elif isinstance(node, list):
        for value in node:
            yield from refs(value)


all_refs = list(refs(SPEC))
for ref in all_refs:
    assert ref.startswith("#/"), ref
    resolve(ref)

ops = [(path, method, op) for path, methods in SPEC["paths"].items()
       for method, op in methods.items() if method in {"get", "post", "put", "patch", "delete"}]
mutations = [(path, method, op) for path, method, op in ops if method in {"post", "put", "patch", "delete"}]


def param_names(op):
    return {resolve(p["$ref"])["name"] if "$ref" in p else p["name"] for p in op.get("parameters", [])}


missing = []
for path, method, op in ops:
    names = param_names(op)
    label = method.upper() + " " + path
    if "security" not in op:
        missing.append((label, "security declaration"))
    if method in {"post", "put", "patch", "delete"} and path != "/api/v1/oauth/token":
        if "Idempotency-Key" not in names:
            missing.append((label, "Idempotency-Key"))
        if "409" not in op.get("responses", {}):
            missing.append((label, "409 idempotency conflict"))
    if "{" in path and method != "get" and not path.startswith("/api/v1/supplier/auth/challenges/"):
        if "If-Match" not in names and not any(path.endswith(x) for x in (
            "/invitations", "/documents", "/imports", "/supplier-responses/imports")):
            missing.append((label, "If-Match or documented creation exemption"))
    if "If-Match" in names and not {"412", "428"}.issubset(op.get("responses", {})):
        missing.append((label, "412/428"))
    if op.get("security") and not {"401", "403"}.issubset(op.get("responses", {})):
        missing.append((label, "401/403"))
    if "{" in path and "404" not in op.get("responses", {}):
        missing.append((label, "404"))
assert not missing, missing

schemas = SPEC["components"]["schemas"]
decimal = schemas["Decimal"]
assert decimal["type"] == "string" and "pattern" in decimal
bad_numeric = []


def walk_money(node, path=""):
    if isinstance(node, dict):
        if isinstance(node.get("type"), str) and node["type"] in {"number", "integer"} and any(word in path.lower() for word in
              ("price", "amount", "total", "quantity", "cost", "freight", "subtotal")):
            bad_numeric.append(path)
        for key, value in node.items():
            walk_money(value, path + "." + key)
    elif isinstance(node, list):
        for i, value in enumerate(node):
            walk_money(value, path + f"[{i}]")


walk_money(schemas)
assert not bad_numeric, bad_numeric

enum_events = set(schemas["WebhookSubscriptionCreate"]["properties"]["event_types"]["items"]["enum"])
event = schemas["EventEnvelope"]
variants = {x["$ref"].split("/")[-1] for x in event["oneOf"]}
mapped = set(event["discriminator"]["mapping"])
assert mapped == enum_events and len(variants) == len(enum_events), (mapped ^ enum_events, variants)
for variant in variants:
    s = schemas[variant]
    assert "allOf" in s and "unevaluatedProperties" in s

invalid_examples = []
for name, schema in schemas.items():
    if "example" in schema:
        try:
            Draft202012Validator(schema, resolver=RESOLVER).validate(schema["example"])
        except Exception as error:
            invalid_examples.append((name, str(error).splitlines()[0]))
assert not invalid_examples, invalid_examples

# Objects without explicit policy are reported for human review, not silently ignored.
implicit_objects = [name for name, schema in schemas.items() if isinstance(schema, dict)
                    and (schema.get("type") == "object" or "properties" in schema)
                    and "additionalProperties" not in schema and "unevaluatedProperties" not in schema]

report = {"openapi_version": SPEC["openapi"], "paths": len(SPEC["paths"]), "operations": len(ops),
          "mutations": len(mutations), "resolved_refs": len(all_refs), "security_declarations": len(ops),
          "stable_events": len(enum_events), "schema_examples_checked": sum("example" in s for s in schemas.values()),
          "numeric_money_fields": bad_numeric, "implicit_additional_properties_objects": implicit_objects,
          "semantic_errors": missing}
(ROOT / "contracts" / "openapi-validation-result.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps({k: v for k, v in report.items() if k != "implicit_additional_properties_objects"}, ensure_ascii=False))
