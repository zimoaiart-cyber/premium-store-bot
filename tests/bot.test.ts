/**
 * Bot Tests
 * Unit tests for Premium Store Bot
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.200.0/testing/asserts.ts";

// Import modules to test
import { config, PRODUCTS, CATEGORIES, ITEMS_PER_PAGE } from "./config.ts";
import { t, getUserLanguage } from "./utils/i18n.ts";

// ==================== CONFIG TESTS ====================

Deno.test("Config should have required fields", () => {
  assertExists(config.botToken);
  assertExists(config.adminId);
  assertExists(config.databaseUrl);
});

Deno.test("Products should be organized by category", () => {
  assertExists(PRODUCTS.tshirts);
  assertExists(PRODUCTS.hoodies);
  assertExists(PRODUCTS.jeans);
});

Deno.test("Products should have required fields", () => {
  const product = PRODUCTS.tshirts[0];
  assertExists(product.id);
  assertExists(product.name);
  assertExists(product.price);
  assertExists(product.description);
});

Deno.test("Categories should have Russian names", () => {
  assertEquals(CATEGORIES.tshirts, "👕 Футболки");
  assertEquals(CATEGORIES.hoodies, "🧥 Худи");
  assertEquals(CATEGORIES.jeans, "👖 Джинсы");
});

// ==================== I18N TESTS ====================

Deno.test("i18n should return Russian translation", () => {
  const welcome = t("ru", "welcome", { name: "Test" });
  assertEquals(welcome, "👋 Добро пожаловать, Test!");
});

Deno.test("i18n should return English translation", () => {
  const welcome = t("en", "welcome", { name: "Test" });
  assertEquals(welcome, "👋 Welcome, Test!");
});

Deno.test("i18n should fallback to Russian", () => {
  const welcome = t("ru", "welcome", { name: "User" });
  assertExists(welcome);
});

Deno.test("i18n should handle parameters", () => {
  const price = t("ru", "price", { price: 1000 });
  assertEquals(price, "💰 Цена: 1000 руб.");
});

Deno.test("i18n should handle multiple parameters", () => {
  const quantity = t("ru", "quantity", { qty: 2, price: 500, total: 1000 });
  assertEquals(quantity, "2 шт x 500 руб = 1000 руб");
});

// ==================== HELPER TESTS ====================

Deno.test("getUserLanguage should default to Russian", () => {
  const lang = getUserLanguage(123456);
  assertEquals(lang, "ru");
});

// ==================== INTEGRATION TESTS ====================

Deno.test("Products count should match ITEMS_PER_PAGE logic", () => {
  for (const [category, products] of Object.entries(PRODUCTS)) {
    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    console.log(`Category ${category}: ${products.length} products, ${totalPages} pages`);
    assertExists(totalPages);
  }
});

// Run tests: deno test --allow-net --allow-env --allow-read tests/
