# Rubric

Products {{letters}} each show the same kind of screen. {{intro}}

Each image is named `<product>-<viewport>-<view>-<theme>.png`:
- viewport: `desktop` (1280×800) or `phone` (390×844)
- view: which screen of the product it is
- theme: `light` or `dark`

Products do not all have the same images. Some reference captures are cropped or padded with
white where the source image ended: judge only the UI that is visible, not the padding.
Text already typed into an input is example input.

`DESIGN.md` is the design system one of the products is built on. Read it to understand that
system's intent; score every product on the categories below, by the same standard.

## Categories (score each 1–10, 10 = best in class)

{{categories}}

## Output

Score every image. For every image, name its top 3 weaknesses, each specific enough to act on
(point at the element and say what is wrong). Return only this JSON:

```json
{
  "images": {
    "{{example}}": {
      "scores": {{scores}},
      "weaknesses": ["...", "...", "..."]
    }
  }
}
```
