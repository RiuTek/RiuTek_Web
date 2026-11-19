# Promotional banner artwork

The two static side banners use original illustrations generated with the built-in ImageGen tool. They introduce PC Builder and the component catalog. Text and links are rendered by React so that they remain selectable, accessible and easy to change.

| Asset | Destination | Format |
| --- | --- | --- |
| [PC Builder artwork](../public/banners/pc-builder-promo.webp) | `/pc-builder` | WebP, 480 × 1200, 23,356 bytes |
| [Components artwork](../public/banners/components-promo.webp) | `/products` | WebP, 480 × 1200, 35,010 bytes |

The artwork depicts generic hardware for promotion. Product catalog images continue to describe their individual products. The side banners are maintained in the frontend, and the homepage carousel uses the existing banner-management API.

The banners appear when the viewport is at least 1536 px wide and 720 px high. Width adapts to the space outside the 1280 px content container, up to 240 px per banner. Portrait images are displayed in full, with HTML headings and calls to action overlaid.

<details>
<summary>ImageGen prompt — PC Builder</summary>

```text
Use case: ads-marketing. Create a premium photographic advertising artwork for the LEFT tall sidebar of RiuTek, a Vietnamese PC components store. Portrait canvas 2:5 aspect ratio. Full bleed. Subject: a believable unbranded black glass-sided gaming PC tower, sharply photographed on a dark studio plinth, red edge lighting and subtly glowing red internal fans, realistic metal and glass materials, balanced proportions. Dramatic premium retail electronics photography, charcoal black and rich crimson color palette, clean sophisticated composition with subtle red diagonal light trails. The complete PC tower must be visible in the middle 55% of the image. Leave the top 25% dark and uncluttered for HTML headline overlay, and the bottom 15% dark for an HTML button. Avoid all text, letters, logos, numbers, fake labels, price tags, discounts and watermarks. This is a generic promotional artwork, with no specific product/model claims. Image should feel like a polished e-commerce campaign banner rather than a sci-fi scene.
```

</details>

<details>
<summary>ImageGen prompt — Components</summary>

```text
Use case: ads-marketing. Create the RIGHT tall sidebar advertising artwork for RiuTek, a Vietnamese PC components store. Portrait canvas with 2:5 aspect ratio, premium realistic studio product photography. A tasteful floating arrangement of generic unbranded desktop computer hardware: one black triple-fan graphics card, two black RAM modules and a silver CPU, with sensible proportions, crisp realistic machined surfaces, sophisticated red studio light. The graphics card is the dominant subject in the central 55% of the image, with smaller RAM and CPU beneath it. A deep crimson-to-black gradient environment, subtle plinth reflections, cohesive visual style for an electronics retail campaign. Leave the top 25% relatively clean and dark red for an HTML headline overlay, and bottom 15% clean and dark for an HTML call-to-action. No writing of any kind: no text, letters, numbers, manufacturer marks, logos, watermarks, discount badges or price tags. Generic promotional composition, no specific model promises or brands. Attractive and grounded, no sci-fi city, no busy background.
```

</details>
