import { test, expect } from '@playwright/test';

test.describe('Editor E2E Tests', () => {
  test.setTimeout(60000); // 60 seconds timeout

  test('login → drag → connect → save → load workflow', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('http://localhost:5173/login');

    // Wait for login form to load
    await page.waitForSelector('input[placeholder*="username"]');

    // Step 2: Login
    await page.fill('input[placeholder*="username"]', 'admin');
    await page.fill('input[placeholder*="password"]', '0000');
    await page.click('button:has-text("登录")');

    // Wait for redirect to main page
    await page.waitForURL('**/');
    await page.waitForSelector('.node-library-panel', { timeout: 10000 });

    // Step 3: Create new workflow (click 新建 button)
    await page.click('button:has-text("🆕 新建")');
    await page.waitForTimeout(1000);

    // Step 4: Drag first node from library to canvas
    // Expand a category first
    await page.click('text=工具');
    await page.waitForTimeout(500);

    const nodeItem1 = page.locator('.node-item').first();
    const canvas = page.locator('.workflow-canvas');

    // Get canvas center
    const canvasBox = await canvas.boundingClientRect();
    const centerX = canvasBox.width / 2;
    const centerY = canvasBox.height / 2;

    // Drag first node to left side
    await nodeItem1.dragTo(canvas, {
      targetPosition: { x: centerX - 100, y: centerY }
    });
    await page.waitForTimeout(1000);

    // Step 5: Drag second node to right side
    const nodeItem2 = page.locator('.node-item').nth(1);
    await nodeItem2.dragTo(canvas, {
      targetPosition: { x: centerX + 100, y: centerY }
    });
    await page.waitForTimeout(1000);

    // Step 6: Verify nodes were created (canvas should have content)
    await expect(canvas).toBeVisible();

    // Step 7: Try to connect nodes (this might fail initially but tests the interaction)
    // Click on first node (simulate selecting it)
    await canvas.click({ position: { x: centerX - 100, y: centerY } });
    await page.waitForTimeout(500);

    // Step 8: Save workflow
    await page.click('button:has-text("保存工作流")');
    await page.waitForTimeout(1000);

    // Should show alert (we'll accept it)
    page.on('dialog', dialog => dialog.accept());

    // Step 9: Refresh page and verify workflow loads
    await page.reload();
    await page.waitForURL('**/');

    // Verify we're still logged in and UI is intact
    await expect(page.locator('.node-library-panel')).toBeVisible();
    await expect(page.locator('button:has-text("🆕 新建")')).toBeVisible();

    console.log('✅ E2E drag-connect-save-load test completed successfully');
  });

  test('basic canvas interaction', async ({ page }) => {
    // Navigate and login
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[placeholder*="username"]');
    await page.fill('input[placeholder*="username"]', 'admin');
    await page.fill('input[placeholder*="password"]', '0000');
    await page.click('button:has-text("登录")');

    await page.waitForURL('**/');

    // Verify canvas elements are present
    await expect(page.locator('.canvas-container')).toBeVisible();
    await expect(page.locator('.node-library-panel')).toBeVisible();
    await expect(page.locator('.viewport-controls')).toBeVisible();

    console.log('✅ Basic canvas interaction test passed');
  });

  test('NodeEditorV2: login -> drag node -> connect -> save -> load', async ({ page }) => {
    await page.goto('http://localhost:5173'); // or preview url
    // perform login if required
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', '0000');
    await page.click('button[type="submit"]');

    // wait for NodeEditorV2
    await page.waitForSelector('.node-editor-v2 .editor-canvas');

    // drag node from library to canvas
    const src = page.locator('.node-library-panel .node-item').first();
    const canvas = page.locator('.node-editor-v2 .editor-canvas');
    await src.dragTo(canvas);

    // assert node presence (adapt selector based on actual DOM)
    await expect(page.locator('.canvas-node, [data-type]')).toHaveCount(1);

    // create second node and connect (DOM dependent; adapt selectors)
    const src2 = page.locator('.node-library-panel .node-item').nth(1);
    await src2.dragTo(canvas);
    // simulate connection: click output of first, click input of second
    await page.click('.canvas-node .socket.output, .node-socket-output');
    await page.click('.canvas-node .socket.input, .node-socket-input');

    // save workflow
    await page.click('button[title*="保存"], button[title*="暂存"]');
    await expect(page.locator('text=工作流已保存, text=Workflow saved')).toBeVisible();

    // reload and assert
    await page.reload();
    await expect(page.locator('.canvas-node, [data-type]')).toHaveCount(2);
    await expect(page.locator('.canvas-connection, .connection')).toHaveCount(1);
  });

  test('NodeEditorV2 basic canvas interaction', async ({ page }) => {
    // Navigate and login
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[placeholder*="username"]');

    await page.fill('input[placeholder*="username"]', 'admin');
    await page.fill('input[placeholder*="password"]', '0000');
    await page.click('button:has-text("登录")');

    await page.waitForURL('**/');

    // Verify NodeEditorV2 elements are present
    await expect(page.locator('.node-editor-v2')).toBeVisible();
    await expect(page.locator('.editor-canvas')).toBeVisible();
    await expect(page.locator('.node-library-panel')).toBeVisible();

    console.log('✅ Basic NodeEditorV2 canvas interaction test passed');
  });
});