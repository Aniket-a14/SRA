import { JSDOM } from 'jsdom';

async function testInit() {
    console.log("Starting JSDOM...");
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="mermaid-holder"></div></body></html>', {
        url: "http://localhost",
        contentType: "text/html",
        includeNodeLocations: true,
        storageQuota: 10000000
    });

    const { window } = dom;
    global.window = window;
    global.document = window.document;
    global.navigator = window.navigator;
    global.DOMParser = window.DOMParser;
    global.Node = window.Node;
    global.CustomEvent = window.CustomEvent;
    global.HTMLElement = window.HTMLElement;
    global.SVGElement = window.SVGElement;
    global.XMLSerializer = window.XMLSerializer;
    global.self = global;

    console.log("Importing mermaid...");
    try {
        const mermaid = (await import('mermaid')).default;
        console.log("Initializing mermaid...");
        mermaid.initialize({ startOnLoad: false });
        console.log("Successfully initialized!");

        const testCode = 'graph TD; A-->B;';
        console.log(`Parsing test code: ${testCode}`);
        try {
            await mermaid.parse(testCode);
            console.log("✅ Parse success!");
        } catch (e) {
            console.error("❌ Parse failed:", e);
        }
    } catch (e) {
        console.error("❌ Critical Failure:", e);
    }
}

testInit();
