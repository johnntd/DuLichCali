# Patch Prompt — Fix Mobile Barber Service Images + Mobile Service Slider Panel

## Problem
On `/mobile-barber`, every service card is using the same generic barber image. This looks unprofessional and does not help customers understand the service.

Also, the services are displayed as a long grid. On mobile, this is too much scrolling. The Mobile Barber service selector should use a swipeable panel/carousel like the nail salon service page, so customers can slide through services and select one easily.

---

## Goals
1. Generate or assign a unique, service-specific image for every Mobile Barber service.
2. Replace the long mobile service grid with a mobile-friendly horizontal sliding service panel.
3. Keep desktop layout clean.
4. Reuse the same UX pattern as the nail salon service carousel/panel if available.
5. Do not break existing salon, vendor, ride, food, travel, or AI receptionist pages.

---

## Service Image Requirements
Each service must have a distinct image:
- Classic Haircut
- Fade Haircut
- Skin Fade
- Taper Fade
- Haircut + Beard
- Beard Trim
- Kids Haircut
- Senior Haircut
- Business Style Haircut
- Buzz Cut
- Line Up
- Modern Styling
- Home Family Package

If the project has an AI image generation pipeline, use it to generate realistic promotional service images.

If no image pipeline exists, create structured image prompt metadata and fallback placeholder URLs per service, but do NOT reuse the same image for all services.

Each service image record should include:
```js
{
  serviceId,
  vendorId,
  imageUrl,
  imagePrompt,
  imageAlt,
  category,
  isAIGenerated: true,
  active: true
}
```

Add customer-facing disclosure where needed:

> Sample AI-generated style preview. Real barber portfolio coming soon.

---

## Example AI Image Prompts

Classic Haircut:
> realistic mobile barber in-home classic men haircut, clean professional result, natural lighting, modern grooming photography

Fade Haircut:
> realistic sharp fade haircut result, mobile barber service, clean blend, professional haircut photography, no celebrity, no logo

Skin Fade:
> realistic skin fade haircut close-up, sharp blend, professional barber result, indoor mobile haircut service

Taper Fade:
> realistic taper fade haircut, clean neckline and side blend, professional mobile barber promotional photo

Haircut + Beard:
> realistic men haircut and beard trim result, clean beard line, fresh haircut, mobile barber promotion

Beard Trim:
> realistic beard trim and lineup, clean neck line, professional grooming service, mobile barber

Kids Haircut:
> realistic child haircut at home, clean kids haircut, family-friendly mobile barber service, warm natural lighting

Senior Haircut:
> realistic senior gentleman haircut at home, clean classic haircut, respectful professional mobile barber service

Business Style Haircut:
> realistic professional business haircut, clean executive style, neat side part, mobile barber finished result

Buzz Cut:
> realistic buzz cut haircut result, clean even guard length, simple professional mobile barber service

Line Up:
> realistic hairline edge up lineup haircut, sharp clean edges, professional barber close-up

Modern Styling:
> realistic modern men hairstyle with product styling, clean texture, professional mobile barber result

Home Family Package:
> realistic family mobile haircut service at home, barber setup, father and child haircut theme, warm professional promotional photo

---

## Mobile Service Panel Requirements

On small screens, replace the grid with a swipeable service selector panel.

Behavior:
- Horizontal swipe carousel
- One large service card visible at a time or 1.15 cards visible
- Smooth scroll snap
- Large image
- Clear service name
- Price
- Duration
- Travel buffer
- Cleanup buffer
- "Select Service" button
- Sticky or visible booking CTA after selection
- Dots or small progress indicator
- Left/right arrows optional
- Touch-friendly spacing
- No tiny buttons

Desktop behavior:
- Grid layout is acceptable
- Or responsive carousel if already consistent with site design

Mobile breakpoint:
```css
@media (max-width: 768px)
```

---

## Layout Style

Match the nail salon service panel style:
- Premium card panels
- Rounded corners
- Large images
- Swipeable service selection
- Clear CTA
- Mobile-first spacing
- Avoid long vertical scrolling
- Keep page fast and lightweight

---

## Selection Flow

When user taps "Select Service":
1. Store selected service.
2. Highlight selected service card.
3. Show booking CTA:
   - "Book this service"
   - "Chat with AI to book"
   - "Talk to AI to book"
4. Pass selected service into manual booking and AI booking context.

The AI assistant should know which service was selected.

---

## Verification

Test:
- `/mobile-barber` on iPhone width
- `/mobile-barber` on Android width
- desktop width
- service images are unique
- no service uses the same repeated generic image unless intentionally unavailable
- service slider swipes smoothly
- selecting a service works
- selected service is passed to booking
- selected service is passed to AI chat/voice context
- existing nail salon page still works
- existing vendor pages still work

---

## Required Output

Report:
1. Files changed
2. Whether AI image generation pipeline exists
3. Service images generated or prompt metadata created
4. Number of unique service images
5. Mobile service panel implementation details
6. Tests run
7. PASS / BLOCKED
