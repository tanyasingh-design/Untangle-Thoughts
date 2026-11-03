# Implementation Plan: Clean Per-User Local Cache & Fresh Blank Worry Line

## Overview
Update the worry journal initialization and browser storage (`localStorage`) so that every visitor starts with a clean slate—a single blank worry line ready to type—and only sees the thoughts they personally create on their own device/browser. Keep the Gemini API integration intact for custom AI dilemma reframes and *what / how / when* action suggestions.

## Planned Changes

### 1. Remove Pre-Populated Sample Worries (`src/types/worryTree.ts`)
- Update `INITIAL_DIARY_PAGES` so it contains **only one blank worry line** (`id: 'page-new'`, `title: 'New Worry Journal'`, `rootWorry: ''`) initialized with today's date (`new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`).
- Remove the three hardcoded sample pages (`page-designer`, `page-milestone`, and `page-rent`) so new visitors never see pre-written worries in their `past lines` drawer.

### 2. Clean Browser Cache Initialization & Isolation (`src/App.tsx`)
- Keep all journal pages persisted in the visitor's browser `localStorage` so each user's thoughts remain private to their own browser/device and persist across page reloads.
- Filter out legacy demo page IDs (`page-designer`, `page-milestone`, `page-rent`) when hydrating from `localStorage` so existing browser caches immediately shed the sample entries while keeping any real thoughts the user has written.
- Ensure that if a user deletes all lines and reloads, or opens the site for the first time, it cleanly initializes with one blank worry line ready to type.

### 3. Preserve Gemini API for Custom Reframes & Suggestions (`server.ts` & `src/components/WorryTreeCanvas.tsx`)
- Keep the `/api/detect-worry-category` and `/api/worry-trio-suggestions` Gemini endpoints and client hooks unchanged so custom AI reframes and action chips continue working seamlessly.
