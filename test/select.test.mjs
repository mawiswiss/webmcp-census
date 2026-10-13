import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSideEffectWord, selectTool, selectableIn } from "../src/lib/select.mjs";

const ro = { annotations: { readOnlyHint: true } };

test("only read-only tools are selected", () => {
  assert.equal(selectTool({ name: "search_products", ...ro }), true);
  assert.equal(selectTool({ name: "search_products", annotations: {} }), false);
  assert.equal(selectTool({ name: "search_products" }), false);
  assert.equal(selectTool({ name: "search_products", annotations: { readOnly: true } }), true);
});

test("a side-effect word in the name excludes a tool even when it is declared read-only", () => {
  for (const name of ["send_report", "addToCart", "subscribe-newsletter", "create_order", "delete_item", "shareOnX", "track_event", "login"]) {
    assert.equal(hasSideEffectWord(name), true, name);
    assert.equal(selectTool({ name, ...ro }), false, name);
  }
  for (const name of ["get_posts", "list_orders", "search_templates", "about", "surprise_me", "getCartTotal", "get_post", "view_cart", "list_saved_items"]) {
    assert.equal(hasSideEffectWord(name), false, name);
  }
});

test("a name registered with different hints in different frames is never selected", () => {
  const tools = [
    { name: "get_dup", annotations: { readOnlyHint: true }, frame: 0 },
    { name: "get_dup", annotations: {}, frame: 1 },
    { name: "get_one", annotations: { readOnlyHint: true }, frame: 0 },
    { name: "get_twice", annotations: { readOnlyHint: true }, frame: 0 },
    { name: "get_twice", annotations: { readOnlyHint: true }, frame: 1 },
  ];
  const pick = selectableIn(tools);
  assert.deepEqual(tools.filter(pick).map((t) => `${t.name}@${t.frame}`), ["get_one@0", "get_twice@0", "get_twice@1"]);
});
