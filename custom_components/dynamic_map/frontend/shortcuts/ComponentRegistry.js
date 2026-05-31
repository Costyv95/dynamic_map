import { renderCircle } from './components/renderCircle.js?v=3.0.3-de0f3a8-dev-130032';
import { renderRect } from './components/renderRect.js?v=3.0.3-de0f3a8-dev-130032';
import { renderPill } from './components/renderPill.js?v=3.0.3-de0f3a8-dev-130032';
import { renderIcon } from './components/renderIcon.js?v=3.0.3-de0f3a8-dev-130032';
import { renderImage } from './components/renderImage.js?v=3.0.3-de0f3a8-dev-130032';
import { renderText } from './components/renderText.js?v=3.0.3-de0f3a8-dev-130032';
import { renderGauge } from './components/renderGauge.js?v=3.0.3-de0f3a8-dev-130032';
import { renderLinearBar } from './components/renderLinearBar.js?v=3.0.3-de0f3a8-dev-130032';
import { renderBadge } from './components/renderBadge.js?v=3.0.3-de0f3a8-dev-130032';
import { renderCurvedGauge } from './components/renderCurvedGauge.js?v=3.0.3-de0f3a8-dev-130032';
import { renderLinePath } from './components/renderLinePath.js?v=3.0.3-de0f3a8-dev-130032';
import { renderSelector } from './components/renderSelector.js?v=3.0.3-de0f3a8-dev-130032';
import { renderAlarmClock } from './components/renderAlarmClock.js?v=3.0.3-de0f3a8-dev-130032';
import { renderCalendarCard } from './components/renderCalendarCard.js?v=3.0.3-de0f3a8-dev-130032';
import { renderTimeline } from './components/renderTimeline.js?v=3.0.3-de0f3a8-dev-130032';

export const ComponentRegistry = {
    circle: renderCircle,
    rect: renderRect,
    pill: renderPill,
    icon: renderIcon,
    image: renderImage,
    text: renderText,
    progress_ring: renderGauge,
    linear_bar: renderLinearBar,
    badge: renderBadge,
    curved_gauge: renderCurvedGauge,
    line_path: renderLinePath,
    room_selector: renderSelector,
    alarm_clock: renderAlarmClock,
    calendar_card: renderCalendarCard,
    timeline: renderTimeline
};

