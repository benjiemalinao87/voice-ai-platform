# Lessons Learned

## Transcript Hover Tooltip Feature (October 15, 2025)

### Feature Implementation
Added hover tooltip to display call transcripts in the Recordings component, similar to VAPI's interface.

### Implementation Details
1. **Updated Recording interface** to support conversation-style transcripts with message objects containing role, text, and timestamp
2. **Created hover state** using `onMouseEnter` and `onMouseLeave` events
3. **Styled transcript tooltip** as a dark overlay with color-coded messages (green for assistant, blue for user)
4. **Mock data** includes realistic funeral home conversations with multiple back-and-forth exchanges

### Key Components
- `TranscriptMessage` interface for structured conversation data
- Hover-activated tooltip positioned absolutely below the button
- Color-coded role labels for easy conversation flow reading
- Timestamps for each message
- Max height with scroll for longer conversations

### Files Modified
- `src/components/Recordings.tsx` - Added transcript hover tooltip feature

---

## Voice Selection Integration with VAPI (October 15, 2025)

### Problem
Voice selections were not saving when updating agents. After selecting a voice and clicking save, the changes would not persist after page refresh. Console showed 400 errors from VAPI API.

### Root Cause
1. **Wrong voice provider**: Initially used `provider: 'playht'` but VAPI's built-in voices use `provider: 'vapi'`
2. **Incorrect voice ID capitalization**: Voice IDs must be capitalized (e.g., `Elliot`, `Savannah`, `Spencer`) not lowercase (e.g., `elliot`, `savannah`, `spencer`)

### Solution
1. Changed voice provider from `'playht'` to `'vapi'` in `api.ts` for both `update` and `create` functions
2. Updated all voice IDs in `AgentConfig.tsx` to use proper capitalization
3. Added all available VAPI voices: Paige, Rohan, Hana, Elliot, Cole, Harry, Spencer, Kylie, Lily, Neha, Savannah

### How It Should Be Done
```typescript
// ✅ CORRECT
vapiUpdates.voice = {
  provider: 'vapi',
  voiceId: 'Elliot'  // Capitalized
};
```

### How It Should NOT Be Done
```typescript
// ❌ WRONG - incorrect provider
vapiUpdates.voice = {
  provider: 'playht',  // Wrong provider
  voiceId: 'elliot'    // Wrong capitalization
};
```

### Key Takeaways
- Always check VAPI API error messages - they provide exact requirements (in this case, the error message listed all valid voice IDs with proper capitalization)
- VAPI has multiple voice providers (vapi, playht, 11labs, cartesia) - use the correct one for your voice selection
- Voice IDs are case-sensitive
- When integrating with third-party APIs, verify the exact format requirements through error messages or documentation

### Files Modified
- `src/lib/api.ts` - Updated voice provider to 'vapi' in update and create functions
- `src/components/AgentConfig.tsx` - Capitalized all voice IDs and added Lily voice

---

## Professional Bar Chart Component (October 15, 2025)

### Feature Implementation
Transformed basic bar chart into a professional, interactive data visualization component with proper axes, gridlines, and hover effects.

### Implementation Details
1. **Y-axis with gridlines** - Added Y-axis labels (0 to max value) with 5 evenly spaced horizontal gridlines
2. **Interactive tooltips** - Hover over bars displays formatted data with smooth fade-in animation
3. **Visual enhancements:**
   - Dynamic shadow effects (increases on hover)
   - Scale animation (1.05x zoom on hover)
   - Gradient shine effect on bars
   - Rounded top corners for modern look
4. **Proper scaling** - Values rounded to nearest 100 for clean Y-axis labels
5. **Better layout** - Integrated X-axis labels with proper spacing

### How It Should Be Done
```typescript
// ✅ CORRECT - Professional bar chart with all features
<BarChart 
  data={sentimentData} 
  height={240} 
  showValues={true} 
  showGridlines={true} 
/>

// Chart includes:
// - Y-axis with scale
// - Horizontal gridlines
// - Interactive hover tooltips
// - X-axis labels
// - Smooth animations
```

### How It Should NOT Be Done
```typescript
// ❌ WRONG - Basic bars without proper visualization
<div style={{ height: `${percent}%`, backgroundColor: color }} />

// Missing:
// - No axes or scale reference
// - No gridlines for context
// - No interactivity
// - No tooltips
```

### Key Takeaways
- Professional charts need axes, gridlines, and proper scaling
- Interactive elements (hover effects, tooltips) greatly improve UX
- Use rounded values for cleaner axis labels (round to nearest 100)
- Layer elements properly (gridlines behind bars)
- Add visual feedback on interaction (shadow, scale, shine effects)
- Calculate proper percentages based on rounded max value, not exact max

### Files Modified
- `src/components/BarChart.tsx` - Complete rewrite with professional features
- `src/components/SentimentKeywords.tsx` - Updated to use new gridlines prop

---

## Professional Multi-Line Chart Component (October 15, 2025)

### Feature Implementation
Enhanced multi-line chart with advanced interactive features including point-specific tooltips, vertical crosshair, and multi-value display for time-series data visualization.

### Implementation Details
1. **Interactive data points** - Hover over individual points to see specific values with animated tooltips
2. **Vertical crosshair** - Dashed vertical line appears on hover to show alignment across all series
3. **Multi-value tooltip** - Hovering near a time point shows all series values at once
4. **Visual feedback:**
   - Points enlarge on hover (3px → 5px) with white stroke outline
   - Drop shadow effect on hovered points
   - Non-hovered lines fade to 40% opacity for focus
   - X-axis labels highlight and bold on hover
5. **Better gridlines** - Increased visibility from 10% to full opacity with proper color
6. **Large hover areas** - 12px invisible circles around points for easier interaction

### How It Should Be Done
```typescript
// ✅ CORRECT - Professional multi-line chart with interactivity
const [hoveredPoint, setHoveredPoint] = useState<{ seriesIndex: number; pointIndex: number } | null>(null);
const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

// Invisible hover area for better UX
<circle
  cx={point.x}
  cy={point.y}
  r="12"
  fill="transparent"
  className="cursor-pointer"
  onMouseEnter={() => {
    setHoveredPoint({ seriesIndex, pointIndex });
    setHoveredColumn(pointIndex);
  }}
/>

// Visible point that scales on hover
<circle
  cx={point.x}
  cy={point.y}
  r={isHovered ? "5" : "3"}
  fill={s.color}
/>
```

### How It Should NOT Be Done
```typescript
// ❌ WRONG - No interactivity or hover states
<circle cx={x} cy={y} r="3" fill={color} />

// Missing:
// - No hover detection
// - No tooltips
// - No visual feedback
// - Small hit areas (hard to click)
```

### Key Takeaways
- Use invisible larger circles (r="12") around visible points for easier hover detection
- Implement both point-specific and column-wide hover states for flexibility
- Fade non-hovered elements to 40% opacity to create focus
- Add drop shadows and white strokes to highlight active points
- Vertical crosshair helps users align values across multiple series
- Multi-value tooltips reduce cognitive load by showing all data at once
- Position tooltips dynamically based on SVG coordinates converted to percentages
- Use `pointer-events-none` on tooltips to prevent hover interference

### Files Modified
- `src/components/MultiLineChart.tsx` - Added advanced interactivity and hover states

---

## Professional Donut Chart Component (October 15, 2025)

### Problem
Donut chart was not visible - only text labels appeared, no visual chart rendering. This was especially problematic when one segment was 100% (full circle edge case).

### Root Cause
1. **100% edge case** - When a segment is 360 degrees, SVG path rendering fails
2. **Low contrast** - No background circle to show the chart area
3. **Poor visibility** - Chart was too small and lacked visual effects
4. **No interactivity** - Static chart with no hover feedback

### Solution
1. **Fixed 100% rendering** - Adjusted angles >= 359.99 to 359.99 to prevent full-circle rendering issues
2. **Added background circle** - Light gray background ring to show the chart area even when segments are minimal
3. **Interactive hover states:**
   - Segments scale up (1.05x) and brighten on hover
   - Non-hovered segments fade to 50% opacity
   - Legend items scale and glow on hover
   - Center text dynamically shows hovered segment value
4. **Better sizing** - Increased default size from 180px to 200px with thicker stroke
5. **Visual polish** - Added drop shadows, smooth transitions, and color glows

### How It Should Be Done
```typescript
// ✅ CORRECT - Handle 100% edge case and add visibility features
const adjustedAngle = angle >= 359.99 ? 359.99 : angle;

// Background circle for visibility
<circle
  cx={center}
  cy={center}
  r={radius}
  fill="none"
  stroke="currentColor"
  strokeWidth={strokeWidth}
  className="text-gray-100 dark:text-gray-800"
/>

// Interactive segments with hover
<path
  d={segment.path}
  fill={segment.color}
  className="transition-all duration-300 cursor-pointer"
  style={{
    filter: isHovered 
      ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2)) brightness(1.1)' 
      : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
  }}
  onMouseEnter={() => setHoveredIndex(index)}
/>
```

### How It Should NOT Be Done
```typescript
// ❌ WRONG - No edge case handling or visibility features
const angle = (item.value / total) * 360; // Can be exactly 360
<path d={path} fill={color} /> // No background, no hover, no effects

// Results in:
// - Invisible chart when 100%
// - Poor contrast
// - No interactivity
```

### Key Takeaways
- SVG arcs fail to render when exactly 360 degrees - always cap at 359.99
- Add background circles/rings to show chart area even with minimal data
- Use hover states on both the chart segments and legend items
- Update center text dynamically to show hovered segment value
- Fade non-hovered elements to create focus (50% opacity is ideal)
- Add drop shadows and brightness filters for depth
- Scale transform (1.05x) provides tactile feedback without being disruptive
- Always test edge cases: 0%, 100%, very small percentages

### Files Modified
- `src/components/DonutChart.tsx` - Complete rewrite with visibility and interactivity
- `src/components/PerformanceDashboard.tsx` - Updated chart size

