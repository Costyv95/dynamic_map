import { renderCircle } from './components/renderCircle.js?v=2.74';
import { renderRect } from './components/renderRect.js?v=2.74';
import { renderPill } from './components/renderPill.js?v=2.74';
import { renderIcon } from './components/renderIcon.js?v=2.74';
import { renderImage } from './components/renderImage.js?v=2.74';
import { renderText } from './components/renderText.js?v=2.74';
import { renderGauge } from './components/renderGauge.js?v=2.74';
import { renderLinearBar } from './components/renderLinearBar.js?v=2.74';
import { renderBadge } from './components/renderBadge.js?v=2.74';
import { renderCurvedGauge } from './components/renderCurvedGauge.js?v=2.74';
import { renderLinePath } from './components/renderLinePath.js?v=2.74';
import { renderSelector } from './components/renderSelector.js?v=2.74';
import { renderAlarmClock } from './components/renderAlarmClock.js?v=2.74';
import { renderCalendarCard } from './components/renderCalendarCard.js?v=2.74';
import { renderTimeline } from './components/renderTimeline.js?v=2.74';

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

