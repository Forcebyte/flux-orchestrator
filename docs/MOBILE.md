# Mobile Responsive Design

Flux Orchestrator now includes comprehensive mobile and tablet support, allowing you to manage your Flux clusters from any device.

## Features

### 📱 Responsive Layouts

The application automatically adapts to different screen sizes:

- **Desktop (> 1024px)**: Full multi-column layout with sidebar
- **Tablet (768px - 1024px)**: Optimized 2-column layouts with hamburger menu
- **Mobile (< 768px)**: Single-column layout with card-based views
- **Small Mobile (< 480px)**: Compact design with stacked elements

### 🍔 Mobile Navigation

On mobile devices (< 768px), the sidebar transforms into a slide-out menu:

- **Hamburger Button**: Fixed top-left button to toggle menu
- **Slide Animation**: Smooth sidebar slide-in from the left
- **Overlay**: Dark overlay behind menu for focus
- **Auto-close**: Menu closes when selecting a page or tapping overlay

### 📊 Adaptive Components

#### Dashboard
- Stats grid becomes single column on mobile
- Cards stack vertically for better readability
- Charts and graphs scale appropriately

#### Log Aggregation
- **Table → Cards**: Log table transforms to mobile-friendly cards
- **Touch-Friendly Filters**: Larger buttons and inputs
- **Level Badges**: Grid layout for log level filters (2 columns on mobile)
- **Collapsible Filters**: Advanced filters collapse to save space
- **Horizontal Scrolling**: Tables scroll horizontally when needed

#### RBAC Settings
- Tabs scroll horizontally on narrow screens
- Role cards stack in single column
- Tables become scrollable
- Modal dialogs adapt to screen size
- Buttons stack vertically on small screens

#### Cluster Details
- Resource tables scroll horizontally
- Action buttons remain accessible
- Diff viewer adapts to viewport

### 🖱️ Touch Optimization

- **Larger Touch Targets**: All buttons meet 44x44px minimum
- **Increased Spacing**: Better gap between interactive elements
- **Prevent Zoom**: Proper input font sizes (16px+) prevent iOS zoom
- **Swipe Support**: Horizontal scrolling for tables and lists

## Breakpoints

```css
/* Tablet & Desktop */
@media (max-width: 1024px) { ... }

/* Tablet */
@media (max-width: 768px) { ... }

/* Mobile */
@media (max-width: 480px) { ... }

/* Landscape Mobile */
@media (max-height: 500px) and (orientation: landscape) { ... }
```

## Mobile-Specific Styles

### Sidebar Menu (Mobile)
```css
.sidebar {
  position: fixed;
  left: -240px;
  transition: left 0.3s ease;
}

.sidebar.mobile-open {
  left: 0;
}
```

### Mobile Cards (Log Aggregation)
On mobile, the log table automatically converts to a card-based layout:
- Each log entry becomes a card with border-left color coding
- Time, level, and metadata displayed prominently
- Full message visible with proper word wrapping
- Expand/collapse for additional details

### Responsive Typography
- Desktop: 14-16px base font
- Mobile: 13-14px base font
- Headings scale down proportionally
- Code/monospace text remains readable

## Testing on Mobile

### Browser DevTools
1. Open Chrome/Firefox DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device preset (iPhone, Pixel, iPad)
4. Test responsive behavior

### Real Device Testing
- iOS Safari: Full touch support, swipe gestures
- Android Chrome: Optimized for Material Design
- Landscape mode: Adjusted layouts for wide screens

## Performance Considerations

### Mobile Optimizations
- Reduced grid columns on small screens
- Lazy loading for large datasets
- Efficient re-renders with React hooks
- CSS transforms for smooth animations

### Touch Performance
- Hardware-accelerated transitions
- Debounced scroll handlers
- Optimized event listeners

## Accessibility

- **Semantic HTML**: Proper heading hierarchy
- **ARIA Labels**: Screen reader support
- **Focus Management**: Keyboard navigation works
- **Contrast Ratios**: WCAG AA compliant in both themes
- **Touch Targets**: Minimum 44x44px tap areas

## Known Limitations

### Mobile Browsers
- Some features may require landscape orientation for optimal viewing
- Very large log tables still require horizontal scrolling
- Complex modals may need vertical scrolling on small screens

### Device Support
- **Minimum**: iOS 12+, Android 8+
- **Recommended**: iOS 15+, Android 11+
- **Best Experience**: Modern browsers with ES6+ support

## Future Enhancements

Potential mobile improvements:
- [ ] Pull-to-refresh functionality
- [ ] Native app wrapper (React Native / Capacitor)
- [ ] Offline mode with service workers
- [ ] Push notifications for alerts
- [ ] Swipe gestures for navigation
- [ ] Mobile-optimized charts/graphs
- [ ] Haptic feedback on actions

## Tips for Mobile Users

### Navigation
- Use the hamburger menu (☰) to access all pages
- Swipe left to close the menu overlay
- Long-press items for context menus (where available)

### Log Viewing
- Use landscape mode for more screen space
- Collapse advanced filters when not needed
- Use search instead of scrolling through many logs
- Level badges show counts at a glance

### Cluster Management
- Tap resource names to view details
- Use "View Diff" for side-by-side comparisons
- Export logs before complex operations

### Performance
- Close unused browser tabs
- Clear cache if experiencing slowdowns
- Use Wi-Fi for large data fetches
- Enable auto-refresh only when needed

## Troubleshooting

### Menu Not Appearing
- Check if browser width < 768px
- Try refreshing the page
- Ensure JavaScript is enabled

### Layout Issues
- Clear browser cache
- Update to latest browser version
- Check for browser extensions interfering with CSS

### Touch Not Working
- Ensure touch events are enabled
- Try disabling browser zoom
- Check for conflicting gesture handlers

## Contributing

To add mobile support to new components:

1. **Use CSS Variables**: Ensures dark mode compatibility
2. **Add Media Queries**: At least @768px and @480px breakpoints
3. **Test on Devices**: Real device testing is crucial
4. **Consider Touch**: Make buttons large enough (44x44px min)
5. **Graceful Degradation**: Features should work, even if layout differs

Example:
```css
.my-component {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 768px) {
  .my-component {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
```

## Resources

- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev: Mobile Performance](https://web.dev/mobile/)
- [A11y Project: Mobile Accessibility](https://www.a11yproject.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Note**: Mobile support is continuously improving. Report issues or suggestions via GitHub Issues.
