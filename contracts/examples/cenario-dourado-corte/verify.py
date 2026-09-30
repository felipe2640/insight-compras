"""Verifica aritmética e isolamento da fixture documental; não é motor de corte."""

import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

fixture = json.loads((Path(__file__).parent / "scenario.json").read_text())
assert fixture["currency"] == "BRL"
assert fixture["policy"]["minimum_order_mode"] == "hard_constraint"
assert fixture["policy"]["assisted_response_mode"] == "allow_with_warning"
assert len(fixture["quotations"]) == 2
assert sum(len(q["items"]) for q in fixture["quotations"]) == 12
assert len({(q["tenant"], q["external_id"]) for q in fixture["quotations"]}) == 2

probes = fixture["commercial_probes"]
box = probes["box_vs_unit"]
assert Decimal(box["A_unit_price"]) < Decimal(box["B_unit_price"])
assert Decimal(box["requested"]) < Decimal(box["A_minimum"])
assert Decimal(box["A_minimum"]) % Decimal(box["A_multiple"]) == 0
assert box["expected_lowest_nominal"] == "A" and box["expected_eligible"] == "B"
freight = probes["freight_per_order"]
cost_c = Decimal(freight["requested"]) * Decimal(freight["C_unit_price"]) + Decimal(freight["C_fixed_freight"])
cost_b = Decimal(freight["requested"]) * Decimal(freight["B_unit_price"])
assert cost_c == Decimal("340.00") and cost_b == Decimal("310.00") and cost_b < cost_c
minimum = probes["minimum_order"]
assert Decimal(minimum["generous_maximum_merchandise"]) < Decimal(minimum["minimum"])
assert minimum["treatment"] == "hard_constraint" and minimum["expected"] == "ineligible_as_order"
partial = probes["partial"]
assert Decimal(partial["requested"]) - Decimal(partial["B_available"]) == Decimal(partial["expected_pending"])
assert probes["substitution"]["accepted"] is False
assert probes["unknown_freight"]["amount"] is None
assert probes["unknown_freight"]["expected_comparison_status"] == "requires_review"
replay = probes["snapshot_replay"]
assert replay["minimum_in_run"] == replay["expected_replay_minimum"] != replay["minimum_after_run"]

# Semantic probes are contract examples, not an AwardStrategy implementation.
modes = probes["minimum_modes"]
low = sum(map(Decimal, modes["low_allocations"]))
high = sum(map(Decimal, modes["high_allocations"]))
threshold = Decimal(modes["minimum"])
assert low == Decimal("200.00") < threshold <= high == Decimal("1500.00")
assert modes["expected_low_warning"] == "warning"
assert modes["expected_low_hard_constraint"] == "infeasible"
assert modes["expected_high_hard_constraint"] == "feasible"
assert (modes["supplier"], modes["destination"], modes["currency"]) == ("A", "F1", "BRL")
assisted = probes["assisted_modes"]
assert assisted["origin"] == "assisted_unconfirmed"
assert assisted["operator"] != assisted["on_behalf_of"]
assert len(assisted["file_sha256"]) == 64
assert assisted["expected"] == {"exclude": "ineligible", "allow_with_warning": "warning", "require_confirmation": "requires_review"}
assert assisted["confirmed_origin"] == "assisted_confirmed" and assisted["confirmed_expected"] == "feasible"
freights = probes["freight_modes"]
assert Decimal(freights["CIF"]) == Decimal(freights["included"]) == 0
assert Decimal(freights["fixed"]) == Decimal("50.00")
assert freights["FOB_unknown"] is freights["unknown"] is None
assert freights["expected_unknown"] == "requires_review"
assert probes["alternative_reference"]["offered"] != probes["alternative_reference"]["requested"]
assert probes["alternative_reference"]["explicitly_accepted"] is True
assert probes["alternative_reference"]["expected"] == "eligible"
tie = probes["tie"]
assert Decimal(tie["A_price"]) == Decimal(tie["B_price"])
assert tie["A_days"] < tie["B_days"]
assert tie["expected_by_line"] != tie["expected_suggested_hard_minimum"]
scenario = probes["scenario_vs_unit"]
assert Decimal(scenario["C_unit_price"]) < Decimal(scenario["B_unit_price"])
assert Decimal(scenario["C_scenario_total"]) > Decimal(scenario["B_scenario_total"])
assert scenario["expected_lowest_unit_price"] != scenario["expected_suggested_award"]

q1 = next(q for q in fixture["quotations"] if q["tenant"] == "T1")
item_by_id = {item["id"]: item for item in q1["items"]}
assert item_by_id["I06"]["reason"] == "NO_ELIGIBLE_OFFER"  # no stock + minimum + multiple
assert item_by_id["I07"]["reason"] == "SUBSTITUTION_REJECTED_A"
assert item_by_id["I11"]["reason"] == "NO_RESPONSE"
assert item_by_id["I10"]["reason"] == "PARTIAL_AVAILABILITY"
assert Decimal(item_by_id["I10"]["awarded_quantity"]) == Decimal("3.000000")
assert Decimal(item_by_id["I10"]["pending_quantity"]) == Decimal("3.000000")
assert Decimal(item_by_id["I01"]["requested_quantity"]) < Decimal(box["A_minimum"])
assert Decimal(box["A_minimum"]) * Decimal(box["A_unit_price"]) == Decimal("100.00")
assert Decimal(box["requested"]) * Decimal(box["B_unit_price"]) == Decimal("73.50")

for quotation in fixture["quotations"]:
    totals = {}
    for item in quotation["items"]:
        requested = Decimal(item["requested_quantity"])
        awarded = Decimal(item["awarded_quantity"])
        pending = Decimal(item["pending_quantity"])
        assert requested > 0 and awarded >= 0 and pending >= 0
        assert awarded + pending == requested, item["id"]
        if awarded:
            key = (item["awarded_supplier"], item["destination"])
            line = (awarded * Decimal(item["unit_price"])).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            totals[key] = totals.get(key, Decimal("0.00")) + line
    expected_sum = Decimal("0.00")
    for order in quotation["expected_orders"]:
        key = (order["supplier"], order["destination"])
        assert totals.pop(key) == Decimal(order["merchandise_total"])
        assert Decimal(order["merchandise_total"]) + Decimal(order["freight_total"]) == Decimal(order["total"])
        expected_sum += Decimal(order["total"])
    assert not totals
    assert expected_sum == Decimal(quotation["expected_total"])

print("golden fixture Decimal arithmetic, commercial scenarios, provenance and tenant-scoped IDs: PASS")
