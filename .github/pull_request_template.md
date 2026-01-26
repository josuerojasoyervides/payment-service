# PR Title

<!-- Example: "Fix PaymentError messageKey mapping in Status page" -->

## 🎯 What changes

-

## 🧠 Why

-

## ✅ Quick checklist

### Architecture

- [ ] Domain remains pure TS (no Angular/RxJS/Http/i18n/logger)
- [ ] I did not add `switch(providerId)` or giant if/else blocks
- [ ] I did not introduce `any` / hacks

### Stability

- [ ] No sync throws escape the stream (safeDefer if applicable)
- [ ] Fallback contract remains intact (handled -> EMPTY)

### UX

- [ ] No infinite loading (timeout or clear exit)

### Tests

- [ ] Tests updated or added (unit/integration as applicable)
- [ ] Vitest passes without \"Unhandled errors\"

## 📦 Files touched

-
