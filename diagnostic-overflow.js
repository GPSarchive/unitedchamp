// Diagnostic Script for iPhone Display Issues
// Run this in browser console to detect overflow problems

console.log('%c🔍 Starting Overflow Diagnostic...', 'color: #00ff00; font-size: 16px; font-weight: bold;');

// 1. Check document width vs viewport width
const docWidth = document.documentElement.scrollWidth;
const viewportWidth = window.innerWidth;
const hasHorizontalScroll = docWidth > viewportWidth;

console.log('\n📏 VIEWPORT ANALYSIS:');
console.log(`Viewport Width: ${viewportWidth}px`);
console.log(`Document Width: ${docWidth}px`);
console.log(`Horizontal Overflow: ${hasHorizontalScroll ? '❌ YES - ' + (docWidth - viewportWidth) + 'px overflow' : '✅ NO'}`);

// 2. Find elements wider than viewport
const wideElements = [];
document.querySelectorAll('*').forEach(el => {
  const rect = el.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(el);

  // Check if element extends beyond viewport
  if (rect.right > viewportWidth || rect.width > viewportWidth) {
    wideElements.push({
      element: el,
      tag: el.tagName.toLowerCase(),
      classes: el.className,
      width: rect.width,
      right: rect.right,
      overflow: rect.right - viewportWidth,
      overflowX: computedStyle.overflowX,
      position: computedStyle.position
    });
  }
});

// 3. Sort by how much they overflow
wideElements.sort((a, b) => b.overflow - a.overflow);

console.log(`\n⚠️ ELEMENTS WIDER THAN VIEWPORT (${wideElements.length} found):`);
wideElements.slice(0, 10).forEach((item, index) => {
  console.log(`\n${index + 1}. <${item.tag}> ${item.classes ? 'class="' + item.classes + '"' : ''}`);
  console.log(`   Width: ${Math.round(item.width)}px`);
  console.log(`   Right edge: ${Math.round(item.right)}px (viewport: ${viewportWidth}px)`);
  console.log(`   Overflow: ${Math.round(item.overflow)}px`);
  console.log(`   overflow-x: ${item.overflowX}`);
  console.log(`   Element:`, item.element);
});

// 4. Highlight problematic elements visually
if (wideElements.length > 0) {
  console.log('\n🎨 Highlighting problematic elements with red border...');
  wideElements.forEach(item => {
    item.element.style.outline = '3px solid red';
    item.element.style.outlineOffset = '-3px';
  });
}

// 5. Check for text that might cause overflow
console.log('\n📝 CHECKING FOR OVERSIZED TEXT:');
const textElements = document.querySelectorAll('h1, h2, h3, .text-6xl, .text-7xl, .text-8xl');
textElements.forEach(el => {
  const rect = el.getBoundingClientRect();
  const fontSize = window.getComputedStyle(el).fontSize;
  if (rect.width > viewportWidth * 0.9) {
    console.log(`⚠️ Large text: <${el.tagName.toLowerCase()}>`);
    console.log(`   Font size: ${fontSize}`);
    console.log(`   Width: ${Math.round(rect.width)}px (${Math.round(rect.width / viewportWidth * 100)}% of viewport)`);
    console.log(`   Text: "${el.textContent.substring(0, 50)}..."`);
  }
});

// 6. Check container constraints
console.log('\n📦 CHECKING CONTAINER OVERFLOW SETTINGS:');
const mainContainers = document.querySelectorAll('body, main, [class*="container"]');
mainContainers.forEach(el => {
  const style = window.getComputedStyle(el);
  console.log(`<${el.tagName.toLowerCase()}> ${el.className ? 'class="' + el.className + '"' : ''}`);
  console.log(`   overflow-x: ${style.overflowX}`);
  console.log(`   overflow-y: ${style.overflowY}`);
  console.log(`   width: ${style.width}`);
  console.log(`   max-width: ${style.maxWidth}`);
});

// 7. Simulate different iPhone sizes
console.log('\n📱 SIMULATED IPHONE VIEWPORTS:');
const iPhoneSizes = {
  'iPhone SE': 375,
  'iPhone 12/13/14': 390,
  'iPhone 12/13/14 Pro Max': 428,
  'iPhone 15 Pro': 393,
  'iPhone 15 Pro Max': 430
};

Object.entries(iPhoneSizes).forEach(([model, width]) => {
  const wouldOverflow = docWidth > width;
  console.log(`${model} (${width}px): ${wouldOverflow ? '❌ OVERFLOW by ' + (docWidth - width) + 'px' : '✅ OK'}`);
});

console.log('\n✅ Diagnostic Complete!');
console.log('\nTo remove red outlines, refresh the page.');
