<div align="center">
  <img src="src/assets/branding/riutek-mark-v2.png" alt="RiuTek logo" width="80" />
  <h1>RiuTek Web</h1>
  <p>Find your components. Put your PC together.</p>
  <p>
    <a href="https://riutek.store">Live website</a> &nbsp;·&nbsp;
    <a href="https://github.com/RiuTek/RiuTek_API">Backend repository</a> &nbsp;·&nbsp;
    <a href="#try-the-demo">Try the demo</a>
  </p>

![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

RiuTek is a personal e-commerce project for buying PC components and choosing parts for a custom build. This repository contains the React storefront and a role-protected administration area.

> **Try it online** — Browse components and export a PC build without an account at [riutek.store](https://riutek.store). Sign in to save builds and try checkout. Stripe uses test mode.

[Features](#features) · [Technology](#technology) · [API integration](#api-and-authentication) · [Setup](#run-locally) · [Build](#checks-and-build) · [Roadmap](#roadmap)

## Features

| Feature | What you can do |
| :--- | :--- |
| **Browse components** | product search, nested categories, technical checkbox filters, sorting, pagination and image galleries. |
| **Build a PC** | choose components, review compatibility findings and estimated power requirements, and download a configuration as a PNG. Guests can use the builder without an account; customers can save and revisit their builds. |
| **Shop and order** | persistent account carts, selection of cart items for checkout, Buy Now for a product or saved build, delivery addresses, COD and Stripe Checkout in test mode. |
| **Manage an account** | registration, sign-in, profile/address updates, saved configurations and order history with the actions supported by each order's state. |
| **Administer the store** | Admin/Staff screens for categories, products, stock adjustments, Excel imports, orders and homepage banners. Bulk import accepts an Excel workbook and an image folder, matching files by SKU before upload to R2. |
| **Browse the homepage** | administrator-managed banner carousel and product rows loaded from the catalog. |

Compatibility messages provide guidance; they do not guarantee that every build is suitable. Stock and price checks remain separate from hardware compatibility. The PNG is generated in the browser and is not uploaded or stored by the backend.

## Technology

| Area | Stack |
| :--- | :--- |
| Application | React 19, TypeScript, Vite |
| Navigation | React Router |
| Interface | Tailwind CSS, Lucide icons |
| Build image export | Native Canvas 2D |
| Hosting | Vercel, API proxy to Azure App Service |

| Source | Purpose |
| :--- | :--- |
| `src/features` | Catalog, PC Builder, account, checkout and administration features |
| `src/layouts` | Shared page layouts |
| `src/components` | Shared UI components |
| `src/app/router.tsx` | Route definitions |

## API and authentication

The client calls relative /api/v1 endpoints. In the Vercel deployment, vercel.json proxies these requests to the Azure-hosted backend and serves the SPA for frontend routes.

Access tokens are held in memory, not localStorage or sessionStorage. Refresh tokens are handled by Secure, HttpOnly cookies. Backend authorization is required for protected operations; frontend route guards do not replace it.

R2 uploads use backend-issued presigned URLs: the browser uploads the image directly and confirms it with the API. R2 credentials remain on the backend.

## Run locally

Use a Node.js version supported by the Vite version in package.json, then run:

```sh
npm ci
npm run dev
```

The example environment variable is:

```text
VITE_API_BASE_URL=/api/v1
```

The client expects a relative API base URL. Vercel rewrites do not run automatically under the Vite development server or vite preview. Running the full application locally therefore requires an equivalent API proxy and a cookie-compatible HTTPS setup. The deployed website is available for trying the complete integration; starting Vite alone does not configure the backend connection.

Do not put database connection strings, JWT signing keys, Stripe secrets, R2 credentials or other backend secrets in VITE variables. These variables are included in the public browser bundle.

## Checks and build

```sh
npm run lint
npm run build
npm run preview
```

The production build is generated in dist. The Vercel project deploys the main branch; its /api rewrite must precede the SPA fallback.

## Try the demo

1. Browse products and filter by a component group.
2. Open the PC Builder, select components and download the configuration image. No sign-in is needed for these steps.
3. Register a customer account to save configurations, manage a cart and try the order flow.
4. Review the resulting order in the account's order history.

Stripe runs in test mode. The site demonstrates checkout and order workflows; it is not presented as a live retail service. Administrative accounts are not published in this repository.

## Roadmap

The current web release covers the storefront, PC Builder, account/cart/checkout flows and store administration listed above.

Future work includes customer-facing posts, comments and reviews screens using the existing backend APIs; AI-assisted build recommendations; VNPay integration; and laptop/prebuilt-PC catalog support. Those features are not included in the current frontend.
