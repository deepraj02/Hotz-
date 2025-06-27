// Background script for Element Key Binder
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Background received message:', request.type);
    
    if (request.type === 'GET_TAB_ID') {
        const tabId = sender.tab?.id;
        console.log('Sending tab ID:', tabId);
        sendResponse({tabId: tabId});
        return true; // Keep message channel open
    }
    
    // Forward messages to popup if it's open
    if (request.type === 'BINDING_CREATED' || request.type === 'BINDING_ERROR') {
        // Try to send to popup (it might not be open)
        chrome.runtime.sendMessage(request).catch(() => {
            // Popup is not open, ignore
            console.log('Could not forward message to popup (likely closed)');
        });
    }
    
    return true;
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('Element Key Binder installed successfully!');
    }
});

// Clean up storage when tabs are closed
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    const tabKey = `bindings_${tabId}`;
    chrome.storage.local.remove([tabKey]);
});
