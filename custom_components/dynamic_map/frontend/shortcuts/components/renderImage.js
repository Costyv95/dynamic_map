import { resolveDataUrl } from '../../shared/DataUrl.js?v=3.2.1';
export function renderImage(svgNS, props) {
    const width = props.width || 24;
    const height = props.height || 24;
    const img = document.createElementNS(svgNS, 'image');
    img.setAttribute('x', (props.x || 0) - width / 2);
    img.setAttribute('y', (props.y || 0) - height / 2);
    img.setAttribute('width', width);
    img.setAttribute('height', height);
    const href = resolveDataUrl(props.value || '');
    img.setAttribute('href', href);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
    img.style.transition = 'width 0.3s ease, height 0.3s ease';
    return img;
}
