document.addEventListener('DOMContentLoaded', function() {
    const startBindingBtn = document.getElementById('startBinding');
    const viewBindingsBtn = document.getElementById('viewBindings');
    const clearAllBtn = document.getElementById('clearAll');
    const statusMessage = document.getElementById('statusMessage');
    const bindingsList = document.getElementById('bindingsList');
    const bindingsContent = document.getElementById('bindingsContent');
    
    let currentTabId = null;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
            currentTabId = tabs[0].id;
            console.log('Current tab ID set to:', currentTabId);
            loadBindings();
        } else {
            console.log('No active tab found');
        }
    });
    
    startBindingBtn.addEventListener('click', function() {
        console.log('Start binding button clicked');
        
        if (!currentTabId) {
            console.log('No current tab ID');
            showStatus('Error: No active tab found', 'error');
            return;
        }
        
        console.log('Sending message to tab:', currentTabId);
        
        showStatus('Initializing element selection...', 'success');
        
        chrome.scripting.executeScript({
            target: {tabId: currentTabId},
            files: ['content.js']
        }, function() {
            if (chrome.runtime.lastError) {
                console.log('Error injecting content script:', chrome.runtime.lastError.message);
                showStatus('Error: Could not load content script', 'error');
                return;
            }
            
            setTimeout(() => {
                console.log('Sending START_ELEMENT_SELECTION message...');
                chrome.tabs.sendMessage(currentTabId, {type: 'START_ELEMENT_SELECTION'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log('Error sending message:', chrome.runtime.lastError.message);
                        showStatus('Error: Content script not responding. Try refreshing the page.', 'error');
                    } else {
                        console.log('Message sent successfully, response:', response);
                        showStatus('Click on any element to select it', 'success');
                        setTimeout(() => window.close(), 1000);
                    }
                });
            }, 200);
        });
    });
    
    viewBindingsBtn.addEventListener('click', function() {
        toggleBindingsList();
    });
    
    clearAllBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all key bindings?')) {
            if (!currentTabId) return;
            
            const tabKey = `bindings_${currentTabId}`;
            chrome.storage.local.remove([tabKey], function() {
                chrome.tabs.sendMessage(currentTabId, {type: 'RELOAD_BINDINGS'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log('Could not notify content script of bindings clear:', chrome.runtime.lastError.message);
                    } else {
                        console.log('Content script notified of bindings clear:', response);
                    }
                });
                
                showStatus('All bindings cleared', 'success');
                loadBindings();
            });
        }
    });
    
    function initializeContentScript() {
        if (!window.elementKeyBinderInitialized) {
            window.elementKeyBinderInitialized = true;
        }
    }
    
    function showStatus(message, type) {
        console.log('Status:', message, type);
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';
        
        const delay = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, delay);
    }
    
    function toggleBindingsList() {
        if (bindingsList.style.display === 'none') {
            bindingsList.style.display = 'block';
            loadBindings();
        } else {
            bindingsList.style.display = 'none';
        }
    }
    
    function loadBindings() {
        if (!currentTabId) return;
        
        const tabKey = `bindings_${currentTabId}`;
        chrome.storage.local.get([tabKey], function(result) {
            const bindings = result[tabKey] || {};
            displayBindings(bindings);
        });
    }
    
    function displayBindings(bindings) {
        const keys = Object.keys(bindings);
        
        if (keys.length === 0) {
            bindingsContent.innerHTML = '<div class="empty-state">No key bindings found for this page</div>';
            return;
        }
        
        bindingsContent.innerHTML = keys.map(key => {
            const binding = bindings[key];
            return `
                <div class="binding-item">
                    <div>
                        <div class="binding-key">${key.toUpperCase()}</div>
                        <div class="binding-element">${binding.elementDescription}</div>
                    </div>
                    <button class="remove-binding" data-key="${key}">×</button>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.remove-binding').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.getAttribute('data-key');
                removeBinding(key);
            });
        });
    }
    
    function removeBinding(key) {
        if (!currentTabId) return;
        
        const tabKey = `bindings_${currentTabId}`;
        chrome.storage.local.get([tabKey], function(result) {
            const bindings = result[tabKey] || {};
            delete bindings[key];
            
            chrome.storage.local.set({[tabKey]: bindings}, function() {
                chrome.tabs.sendMessage(currentTabId, {
                    type: 'BINDING_REMOVED',
                    key: key
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log('Could not notify content script of binding removal:', chrome.runtime.lastError.message);
                        chrome.tabs.sendMessage(currentTabId, {type: 'RELOAD_BINDINGS'});
                    } else {
                        console.log('Content script notified of binding removal:', response);
                    }
                });
                
                loadBindings();
                showStatus(`Key "${key.toUpperCase()}" binding removed`, 'success');
            });
        });
    }
    
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'BINDING_CREATED') {
            showStatus(`Key "${request.key.toUpperCase()}" bound to element`, 'success');
            loadBindings();
        } else if (request.type === 'BINDING_ERROR') {
            showStatus(request.message, 'error');
        }
    });
});
