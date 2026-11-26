---
name: principle-name-the-shape
description: "Apply when you write or name a fixture, constant, test, or comment, above all when a live probe supplied the data."
disable-model-invocation: true
---

# Name the Shape

Name every hand-written fixture, constant, test, and comment after the shape under test: the structure, state, or edge case the code must handle. `blockWithZeroSellLimit`, `HOTEL_WITH_INCLUSIVE_TAX`, and "returns no rooms when every type is closed" each say what the test exercises.

The rule holds when a live probe gave you the shape. The probe tells you which shape exists in the wild. The fixture is still a construction you built to exercise that shape, so its name describes the shape and the values are placeholders.

A real customer name, person, id, or code in a fixture makes the construction read as a record of that customer's configuration. Readers then trust it as their real setup, and it goes stale when that customer changes. Keep the real identifier in the ticket or the probe notes, where it records where the shape was found.
