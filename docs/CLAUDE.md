# Design System & Development Guidelines

This document defines the UI/UX design system and development patterns for the Voice AI Performance & Configuration Dashboard. Follow these guidelines to maintain consistency across all components.

## Core Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (utility-first)
- **Icons**: Lucide React
- **State Management**: React hooks (useState, useEffect)
- **API Integration**: VAPI AI, Supabase

## Design Philosophy

**Lightweight & Custom-Built**: This project uses custom-built components rather than heavy UI libraries. Every component is crafted for purpose, ensuring optimal performance and full design control.

## Color Palette & Theme

### Light Mode
- **Background**: `bg-white`, `bg-gray-50`
- **Text Primary**: `text-gray-900`
- **Text Secondary**: `text-gray-600`, `text-gray-500`
- **Borders**: `border-gray-200`
- **Accent**: `bg-blue-600`, `text-blue-600`
- **Success**: `text-green-600`
- **Error**: `text-red-600`

### Dark Mode
All components support dark mode using `dark:` prefix:
- **Background**: `dark:bg-gray-800`, `dark:bg-gray-700`
- **Text Primary**: `dark:text-gray-100`
- **Text Secondary**: `dark:text-gray-400`
- **Borders**: `dark:border-gray-700`, `dark:border-gray-600`
- **Accent**: `dark:bg-blue-500`, `dark:text-blue-400`
- **Success**: `dark:text-green-400`
- **Error**: `dark:text-red-400`

## Component Patterns

### Card Pattern
Standard card structure for all content containers:

```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
  {/* Content */}
</div>
```

**Features**:
- Rounded corners: `rounded-lg`
- Border: Always visible
- Padding: `p-6` standard
- Optional: `hover:shadow-md transition-shadow` for interactive cards

### Button Patterns

#### Primary Action Button
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
  <Icon className="w-4 h-4" />
  Button Text
</button>
```

#### Secondary Button
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
  <Icon className="w-4 h-4" />
  Button Text
</button>
```

#### Success/Status Button
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
  <Icon className="w-4 h-4" />
  Active
</button>
```

**Button Guidelines**:
- Always use `flex items-center gap-2` for icon + text
- Icon size: `w-4 h-4` or `w-5 h-5`
- Include hover states and transitions
- Add `disabled:opacity-50 disabled:cursor-not-allowed` for disabled states

### Form Input Pattern

```tsx
<input
  type="text"
  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
/>
```

**Textarea Pattern**:
```tsx
<textarea
  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
  rows={8}
/>
```

**Select Pattern**:
```tsx
<select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
  <option>Option</option>
</select>
```

### Information Display Pattern

```tsx
<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
  <p className="text-sm text-gray-600 dark:text-gray-400">Label:</p>
  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Value</p>
</div>
```

### Section Header Pattern

```tsx
<div className="flex items-center gap-2 mb-4">
  <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Section Title</h3>
</div>
```

### Loading State Pattern

```tsx
<div className="flex items-center justify-center h-64">
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
</div>
```

## Typography

### Hierarchy
- **Page Title**: `text-2xl font-bold text-gray-900 dark:text-gray-100`
- **Section Header**: `text-lg font-semibold text-gray-900 dark:text-gray-100`
- **Card Title**: `text-sm font-medium text-gray-600 dark:text-gray-400`
- **Body Text**: `text-sm text-gray-900 dark:text-gray-100`
- **Secondary Text**: `text-sm text-gray-500 dark:text-gray-400`
- **Helper Text**: `text-xs text-gray-500 dark:text-gray-400`

### Metric Display
```tsx
<p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
```

## Spacing

- **Component Spacing**: `space-y-6` between major sections
- **Element Spacing**: `space-y-4` for form fields
- **Small Gaps**: `gap-2` or `gap-3` for inline elements
- **Card Padding**: `p-6` standard, `p-4` for nested content

## Icons

**Icon Guidelines**:
- Use Lucide React for all icons
- Standard size: `w-5 h-5` for section headers
- Button icons: `w-4 h-4`
- Metric cards: `w-6 h-6`
- Icon color: `text-gray-400 dark:text-gray-500` for decorative icons

**Common Icons**:
```tsx
import {
  Volume2,      // Voice/Audio
  MessageSquare,// Conversations
  Settings,     // Configuration
  Key,          // API/Authentication
  Play,         // Test/Run
  Power,        // Active/Status
  Edit3,        // Edit mode
  Check,        // Confirm/Save
  X,            // Cancel/Close
  Save,         // Save action
} from 'lucide-react';
```

## Border & Divider Patterns

### Section Divider
```tsx
<div className="border-b border-gray-200 dark:border-gray-700 pb-6">
  {/* Section content */}
</div>
```

### Card Border
```tsx
border border-gray-200 dark:border-gray-700
```

## Transition Effects

Always include smooth transitions:
- **Colors**: `transition-colors`
- **Shadow**: `transition-shadow`
- **All**: `transition-all` (use sparingly)

## Chart Components

All charts are custom-built with SVG. Standard patterns:

```tsx
// Chart container
<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
    Chart Title
  </h3>
  <svg>{/* Chart content */}</svg>
</div>
```

## Edit Mode Pattern

Components with editable sections use this pattern:

1. Display mode shows data with edit button
2. Edit mode shows form with Save/Cancel buttons
3. State managed with `editMode` state variable
4. Form data in separate `formData` state

```tsx
const [editMode, setEditMode] = useState<string | null>(null);
const [formData, setFormData] = useState<Partial<T>>({});

{editMode === 'section' ? (
  // Edit form with Save/Cancel
) : (
  // Display mode with Edit button
)}
```

## Responsive Design

- Mobile-first approach
- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Flex containers with proper wrap: `flex flex-wrap`
- Grid layouts: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

## State Management Patterns

### Loading State
```tsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState<T | null>(null);
```

### Edit State
```tsx
const [saving, setSaving] = useState(false);
const [editMode, setEditMode] = useState<string | null>(null);
```

### Error Handling
```tsx
try {
  const result = await api.call();
  setData(result);
} catch (error) {
  console.error('Error description:', error);
}
```

## Accessibility Guidelines

- Always provide meaningful button labels
- Use semantic HTML elements
- Include hover and focus states
- Ensure sufficient color contrast
- Add disabled states where appropriate
- Use aria-labels for icon-only buttons

## File Organization

```
src/
├── components/       # Reusable UI components
├── lib/             # API clients, utilities
├── types/           # TypeScript type definitions
└── App.tsx          # Main application
```

## Best Practices

1. **Consistency First**: Always reference this document before creating new components
2. **Dark Mode**: Every new component must support dark mode
3. **TypeScript**: Always type props and state
4. **Reusability**: Extract repeated patterns into shared components
5. **Performance**: Use React.memo for expensive components
6. **No External UI Libraries**: Build custom components that match this design system
7. **Icons**: Always use Lucide React, never other icon libraries

## Code Style

- Use functional components with hooks
- Props interface above component
- Destructure props in component signature
- Early returns for loading/error states
- Logical grouping of related code
- Comments for complex logic only

## When Adding New Features

1. Check existing components for similar patterns
2. Follow the established color palette
3. Use consistent spacing and typography
4. Ensure dark mode support
5. Add hover/focus states
6. Test responsive behavior
7. Update this document if creating new patterns

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
