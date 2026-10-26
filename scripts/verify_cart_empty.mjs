import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import tapMod from '../build/tools/ui-automation/tap.js';
import keyMod from '../build/tools/ui-automation/key_press.js';
import snapshotMod from '../build/tools/ui-automation/snapshot_ui.js';
import screenshotMod from '../build/tools/ui-automation/screenshot.js';

async function main() {
  const server = new McpServer({ name: 'verify_cart', version: '1.0.0' });
  tapMod.register(server);
  keyMod.register(server);
  snapshotMod.register(server);
  screenshotMod.register(server);

  const tap = async (x, y) => server._registeredTools['tap'].handler({ x, y });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log('1. Checking current screen state...');
  let snap = JSON.parse((await server._registeredTools['snapshot_ui'].handler({})).content[0].text);
  let hasDialog = snap.nodes.some((n) => (n.contentDesc || '').includes('Order Submitted') || (n.text || '').includes('Order Submitted'));
  
  if (hasDialog) {
    console.log('Found "Order Submitted" dialog. Tapping "Go Back" at (213, 794)...');
    await tap(213, 794);
    await sleep(2500);
  }

  // Check where we are
  snap = JSON.parse((await server._registeredTools['snapshot_ui'].handler({})).content[0].text);
  let isDashboard = snap.nodes.some((n) => (n.contentDesc || '').includes('Purchase Order'));

  if (!isDashboard) {
    console.log('Navigating back towards Dashboard...');
    await server._registeredTools['key_press'].handler({ keyCode: 4 });
    await sleep(2000);
    snap = JSON.parse((await server._registeredTools['snapshot_ui'].handler({})).content[0].text);
    isDashboard = snap.nodes.some((n) => (n.contentDesc || '').includes('Purchase Order'));
    if (!isDashboard) {
      console.log('Pressing back again to reach Dashboard...');
      await server._registeredTools['key_press'].handler({ keyCode: 4 });
      await sleep(2000);
    }
  }

  console.log('2. Tapping "Your Cart" at (360, 459)...');
  await tap(360, 459);
  await sleep(3500);

  console.log('3. Inspecting Cart UI state...');
  const snapCart = JSON.parse((await server._registeredTools['snapshot_ui'].handler({ interactiveOnly: false })).content[0].text);
  const cartNodes = snapCart.nodes.filter((n) => n.text || n.contentDesc).map((n) => ({
    ref: n.ref,
    class: n.className,
    contentDesc: n.contentDesc,
    text: n.text,
    bounds: n.bounds
  }));
  console.log('Cart nodes after order placement:\n', JSON.stringify(cartNodes, null, 2));

  // Capture screenshot
  const ssRes = await server._registeredTools['screenshot'].handler({});
  const imgContent = ssRes.content.find((c) => c.type === 'image');
  if (imgContent) {
    const outDir = '/Users/kshivam117/MyStorage/devArea/projects/savera/.android-build-mcp/test-reports/screenshots';
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'cart_after_order_placed.png');
    fs.writeFileSync(outFile, Buffer.from(imgContent.data, 'base64'));
    console.log('Cart state screenshot saved to:', outFile);
  }
}

main().catch(console.error);

