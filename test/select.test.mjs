import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTool, hasSideEffectWord } from "../src/lib/select.mjs";

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
