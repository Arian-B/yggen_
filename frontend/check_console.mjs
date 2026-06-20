import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
  page.on('requestfailed', request => console.log('BROWSER_NET_FAIL:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  try {
    // Try to find a link to the map
    await page.waitForSelector('a[href^="/map/"]', { timeout: 3000 });
    const href = await page.$eval('a[href^="/map/"]', el => el.getAttribute('href'));
    console.log('Found map link:', href);
    await page.goto(`http://localhost:5173${href}`, { waitUntil: 'networkidle2' });
  } catch (e) {
    console.log('Could not find map link on home page, trying /learn... just in case');
  }
  
  // Wait a bit for react-force-graph to render
  await new Promise(r => setTimeout(r, 4000));
  
  await browser.close();
})();
