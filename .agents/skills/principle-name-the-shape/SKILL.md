---
name: principle-name-the-shape
description: "Apply when you name or fill a fixture, constant, test, or comment, above all when a live probe supplied the data."
disable-model-invocation: true
---

# Name the Shape

Name every hand-written fixture, constant, test, and comment after the _shape_ under test: the structure, state, or edge case the code must handle. `blockWithZeroSellLimit`, `INCLUSIVE_TAX_RATE_PLAN`, and "returns no rooms when every room type is closed" each name a shape. Fill the values with placeholders that show the shape and nothing else.

A live probe changes nothing. It shows that a shape occurs in real data. The fixture is still a construction you wrote to exercise that shape, so it takes the shape's name. Record where the shape was found in the ticket or the probe notes.

A real customer, person, id, or code in a fixture makes the construction read as a record of that customer's configuration. Replace each one with the shape name or a placeholder.
