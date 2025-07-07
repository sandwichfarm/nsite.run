# nsite.run

An interactive single-page application that explains the nsite protocol - a decentralized static website hosting system built on Nostr and Blossom.

## 🌟 Overview

This Svelte application provides a comprehensive introduction to nsite, featuring:
- Smooth scroll reveal animations
- Responsive design with Tailwind CSS
- Configurable tools and resources section
- Three user perspectives: Publishers, Sys Admins, and Developers

## 📋 Sections

1. **Hero** - Introduction with navigation links
2. **Concept** - What is nsite and how it works
3. **How It Works** - Step-by-step process explanation
4. **Technical Details** - Code examples and implementation flow
5. **Benefits** - Key advantages of using nsite
6. **Tools & Resources** - Ecosystem of tools, gateways, and services
7. **Get Started** - Instructions for different user groups

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 🛠️ Configuration

The tools and resources section is configurable via YAML. Edit `src/lib/tools-resources.yaml` to update:
- Gateways & Servers
- Deployment Tools
- Management & Automation tools
- nsite Gateways
- Blossom Servers
- Nostr Relays

## 📦 Deployment

This project includes automated deployment to Bunny.net via GitHub Actions.

### Required GitHub Secrets
- `BUNNY_ACCESS_KEY`
- `BUNNY_STORAGE_ZONE_NAME`
- `BUNNY_STORAGE_PASSWORD`
- `BUNNY_PULLZONE_ID`

Deployment triggers automatically on push to the `main` branch.

## 🏗️ Tech Stack

- **Svelte 4** - UI framework
- **Vite 5** - Build tool
- **Tailwind CSS 3** - Styling
- **PostCSS** - CSS processing
- **YAML** - Configuration format

## 📝 License

This project is part of the nsite ecosystem. See the [nsite specification](https://github.com/hzrd149/nips/blob/nsite/nsite.md) for more information.

## 🔗 Related Links

- [nsite Specification](https://github.com/hzrd149/nips/blob/nsite/nsite.md)
- [Blossom Specification](https://github.com/hzrd149/blossom)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
