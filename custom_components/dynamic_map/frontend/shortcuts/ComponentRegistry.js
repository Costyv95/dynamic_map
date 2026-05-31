import { renderCircle } from './components/renderCircle.js?v=3.0.3-707e36e-dev-132257';
import { renderRect } from './components/renderRect.js?v=3.0.3-707e36e-dev-132257';
import { renderPill } from './components/renderPill.js?v=3.0.3-707e36e-dev-132257';
import { renderIcon } from './components/renderIcon.js?v=3.0.3-707e36e-dev-132257';
import { renderImage } from './components/renderImage.js?v=3.0.3-707e36e-dev-132257';
import { renderText } from './components/renderText.js?v=3.0.3-707e36e-dev-132257';
import { renderGauge } from './components/renderGauge.js?v=3.0.3-707e36e-dev-132257';
import { renderLinearBar } from './components/renderLinearBar.js?v=3.0.3-707e36e-dev-132257';
import { renderBadge } from './components/renderBadge.js?v=3.0.3-707e36e-dev-132257';
import { renderCurvedGauge } from './components/renderCurvedGauge.js?v=3.0.3-707e36e-dev-132257';
import { renderLinePath } from './components/renderLinePath.js?v=3.0.3-707e36e-dev-132257';
import { renderSelector } from './components/renderSelector.js?v=3.0.3-707e36e-dev-132257';
import { renderAlarmClock } from './components/renderAlarmClock.js?v=3.0.3-707e36e-dev-132257';
import { renderCalendarCard } from './components/renderCalendarCard.js?v=3.0.3-707e36e-dev-132257';
import { renderTimeline } from './components/renderTimeline.js?v=3.0.3-707e36e-dev-132257';

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

