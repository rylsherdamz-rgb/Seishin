# Seishin — Mobile Life Management App

## Overview
Seishin is a serverless, all-in-one mobile life management app that combines schedule management, AI assistance, and P2P communication. Everything runs locally on-device using MMKV storage. P2P features (chat, video calls) use QR code pairing + WebRTC — no backend server required.

## Platform
- **Primary**: Android (API 23+, targeting Infinix Hot 11S NFC)
- **Secondary**: iOS (via Expo cross-compilation)
- **Expo**: Development builds (not Expo Go) via expo-dev-client
- **Minimum RAM**: 4GB (for local GGUF model)

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI Layer (NativeWind B&W + expo-router tabs)                       │
├─────────────────────────────────────────────────────────────────────┤
│  Feature Modules                                                    │
│  ┌──────┐ ┌───────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌───────────┐  │
│  │Calendar│ │ OCR   │ │ Email│ │ Notif.   │ │ P2P  │ │ AI Agent  │  │
│  │       │ │ Scan  │ │ IMAP │ │ Listener │ │ Chat │ │ (Skills)  │  │
│  └──────┘ └───────┘ └──────┘ └──────────┘ └──────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  Storage Layer (ALL MMKV)                                            │
│  events | messages | emails | notifications | agent | settings | ocr │
│  + expo-file-system: GGUF models, OCR temp images                   │
├─────────────────────────────────────────────────────────────────────┤
│  P2P Layer (Serverless, QR + WebRTC)                                │
│  QR Pairing (expo-camera) → WebRTC DataChannel (chat)               │
│  WebRTC MediaTrack (video) → free STUN server                       │
├─────────────────────────────────────────────────────────────────────┤
│  AI Layer                                                            │
│  NVIDIA NIM (cloud, OpenAI SDK) | llama.rn (local GGUF)             │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Calendar
- react-native-calendars, month/week/day views
- Events from: manual, OCR, email, notification, AI agent
- MMKV storage, swipe to delete, tap to edit

### 2. OCR Schedule Scanner
- expo-mlkit-ocr + expo-camera
- Capture → OCR → bounding boxes → parse → save as event
- Heuristic + optional AI parsing

### 3. Email (IMAP)
- Custom native module (AndroidX Mail / MCOIMAP)
- Credentials encrypted in MMKV
- Background sync every 15-30 min
- Extract dates/times → calendar suggestions

### 4. Notification Listener (Android)
- expo-android-notification-listener-service
- Real-time capture + deleted notification recovery
- Parse scheduling intent from any notification

### 5. P2P Chat + Video (QR + WebRTC)
- QR code: `seishin://{ip}:{port}/{userId}/{publicKey}`
- Embedded HTTP server for signaling
- WebRTC DataChannel for chat, MediaTrack for video
- Free STUN: `stun:stun.l.google.com:19302`
- MMKV for all message storage

### 6. AI Agent
- Tool-calling agent loop, pluggable providers
- NVIDIA NIM (cloud) + llama.rn (local GGUF)
- Models: Llama-3.2-3B + TinyLlama-1.1B fallback
- Dynamic skill system (JSON files, install/uninstall)

### 7. Storage Management
- 7 MMKV instances with per-category cleanup
- Auto-cleanup (configurable TTL) + manual clear
- Storage monitoring with threshold warnings
