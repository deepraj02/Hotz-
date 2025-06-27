(function() {
    'use strict';
    
    if (window.elementKeyBinderInitialized) {
        return;
    }
    window.elementKeyBinderInitialized = true;
    
    let isSelectionMode = false;
    let highlightedElement = null;
    let keyBindings = {};
    let currentTabId = null;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    console.log('Element Key Binder: Content script loaded, document state:', document.readyState);
    
    function init() {
        console.log('Element Key Binder: Initializing content script');
        
        loadKeyBindings();
        
        chrome.runtime.onMessage.addListener(handleExtensionMessage);
        
        document.addEventListener('keydown', handleKeyPress, true);
        
        chrome.runtime.sendMessage({type: 'GET_TAB_ID'}, function(response) {
            if (response) {
                currentTabId = response.tabId;
                console.log('Element Key Binder: Tab ID set to', currentTabId);
            }
        });
        
        console.log('Element Key Binder: Content script ready');
    }
    
    function handleExtensionMessage(request, sender, sendResponse) {
        console.log('Content script received message:', request);
        
        if (request.type === 'START_ELEMENT_SELECTION') {
            try {
                startElementSelection();
                sendResponse({success: true, message: 'Element selection started'});
            } catch (error) {
                console.error('Error starting element selection:', error);
                sendResponse({success: false, error: error.message});
                return true;
            }
        } else if (request.type === 'BINDING_REMOVED') {
            const key = request.key;
            if (keyBindings[key]) {
                delete keyBindings[key];
                console.log('Element Key Binder: Binding removed for key:', key);
                sendResponse({success: true, message: 'Binding removed from content script'});
            } else {
                sendResponse({success: false, message: 'Binding not found in content script'});
            }
            return true;
        } else if (request.type === 'RELOAD_BINDINGS') {
            loadKeyBindings();
            sendResponse({success: true, message: 'Bindings reloaded'});
            return true;
        }
        
    }
    
    function startElementSelection() {
        console.log('Element Key Binder: Starting element selection');
        
        if (isSelectionMode) {
            console.log('Element Key Binder: Already in selection mode');
            return;
        }
        
        isSelectionMode = true;
        document.body.style.cursor = 'crosshair';
        
        document.addEventListener('mouseover', highlightElement);
        document.addEventListener('mouseout', unhighlightElement);
        document.addEventListener('click', selectElement, true);
        
        showInstructionOverlay();
        
        console.log('Element Key Binder: Selection mode activated');
    }
    
    function stopElementSelection() {
        isSelectionMode = false;
        document.body.style.cursor = '';
        
        document.removeEventListener('mouseover', highlightElement);
        document.removeEventListener('mouseout', unhighlightElement);
        document.removeEventListener('click', selectElement, true);
        
        if (highlightedElement) {
            unhighlightElement();
        }
        
        hideInstructionOverlay();
    }
    
    function highlightElement(event) {
        if (!isSelectionMode) return;
        
        const element = event.target;
        if (element === highlightedElement) return;
        
        if (highlightedElement) {
            unhighlightElement();
        }
        
        highlightedElement = element;
        element.style.outline = '3px solid #4CAF50';
        element.style.outlineOffset = '2px';
        element.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
    }
    
    function unhighlightElement() {
        if (highlightedElement) {
            highlightedElement.style.outline = '';
            highlightedElement.style.outlineOffset = '';
            highlightedElement.style.backgroundColor = '';
            highlightedElement = null;
        }
    }
    
    function selectElement(event) {
        if (!isSelectionMode) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        stopElementSelection();
        
        showKeySelectionDialog(element);
    }
    
    function showKeySelectionDialog(element) {
        console.log('Element Key Binder: Showing key selection dialog for element:', element);
        const dialog = createKeySelectionDialog(element);
        
        dialog.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 2147483647 !important;
            display: block !important;
        `;
        
        document.body.appendChild(dialog);
        console.log('Element Key Binder: Dialog added to DOM');
        
        setTimeout(() => {
            const input = dialog.querySelector('.key-input');
            if (input) {
                input.focus();
                console.log('Element Key Binder: Input focused');
            } else {
                console.error('Element Key Binder: Could not find input element');
            }
        }, 50);
    }
    
    function createKeySelectionDialog(element) {
        const dialog = document.createElement('div');
        dialog.className = 'key-binder-dialog key-binder-dialog key-binder-dialog';
        
        const elementDescription = getElementDescription(element);
        
        dialog.innerHTML = `
            <div class="key-binder-overlay key-binder-overlay key-binder-overlay">
                <div class="key-binder-modal key-binder-modal key-binder-modal">
                    <div class="key-binder-header key-binder-header key-binder-header">
                        <h3>Assign Key to Element</h3>
                        <button class="key-binder-close key-binder-close key-binder-close">×</button>
                    </div>
                    <div class="key-binder-content key-binder-content key-binder-content">
                        <div class="element-info element-info element-info">
                            <strong>Selected Element:</strong>
                            <div class="element-description element-description element-description">${elementDescription}</div>
                        </div>
                        <div class="key-selection key-selection key-selection">
                            <label for="keyInput">Press any key to assign:</label>
                            <input type="text" id="keyInput" class="key-input key-input key-input" placeholder="Press a key..." readonly>
                        </div>
                        <div class="key-binder-actions key-binder-actions key-binder-actions">
                            <button class="key-binder-btn key-binder-btn key-binder-btn key-binder-btn-primary key-binder-btn-primary key-binder-btn-primary" id="confirmBinding" disabled>Assign Key</button>
                            <button class="key-binder-btn key-binder-btn key-binder-btn key-binder-btn-secondary key-binder-btn-secondary key-binder-btn-secondary" id="cancelBinding">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const input = dialog.querySelector('.key-input');
        const confirmBtn = dialog.querySelector('#confirmBinding');
        const cancelBtn = dialog.querySelector('#cancelBinding');
        const closeBtn = dialog.querySelector('.key-binder-close');
        
        let selectedKey = null;
        
        console.log('Element Key Binder: Setting up dialog event listeners');
        
        input.addEventListener('keydown', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const key = event.key.toLowerCase();
            console.log('Element Key Binder: Key pressed in dialog:', key);
            
            if (['shift', 'ctrl', 'alt', 'meta', 'control'].includes(key)) {
                return;
            }
            
            selectedKey = key;
            input.value = key.toUpperCase();
            confirmBtn.disabled = false;
            console.log('Element Key Binder: Key selected:', key);
        });
        
        confirmBtn.addEventListener('click', function() {
            console.log('Element Key Binder: Confirm button clicked, selectedKey:', selectedKey);
            if (selectedKey) {
                createKeyBinding(selectedKey, element);
                if (dialog.parentNode) {
                    dialog.parentNode.removeChild(dialog);
                }
            }
        });
        
        const cancelHandler = function() {
            console.log('Element Key Binder: Dialog cancelled');
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        };
        
        cancelBtn.addEventListener('click', cancelHandler);
        closeBtn.addEventListener('click', cancelHandler);
        
        dialog.addEventListener('click', function(event) {
            if (event.target === dialog || event.target.classList.contains('key-binder-overlay')) {
                cancelHandler();
            }
        });
        
        dialog.addEventListener('click', function(event) {
            event.stopPropagation();
        });
        
        return dialog;
    }
    
    function createKeyBinding(key, element) {
        if (keyBindings[key]) {
            chrome.runtime.sendMessage({
                type: 'BINDING_ERROR',
                message: `Key "${key.toUpperCase()}" is already bound to another element`
            });
            return;
        }
        
        const selector = generateUniqueSelector(element);
        const elementDescription = getElementDescription(element);
        
        keyBindings[key] = {
            selector: selector,
            elementDescription: elementDescription,
            timestamp: Date.now()
        };
        
        saveKeyBindings();
        
        chrome.runtime.sendMessage({
            type: 'BINDING_CREATED',
            key: key,
            element: elementDescription
        });
    }
    
    function handleKeyPress(event) {
        if (isSelectionMode) return;
        
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
            return;
        }
        
        const key = event.key.toLowerCase();
        
        if (keyBindings[key]) {
            event.preventDefault();
            event.stopPropagation();
            
            const binding = keyBindings[key];
            const element = document.querySelector(binding.selector);
            
            if (element) {
                element.click();
                
                showKeyPressedFeedback(element, key);
            } else {
                console.log('Element Key Binder: Element not found for key:', key, 'removing binding');
                delete keyBindings[key];
                saveKeyBindings();
            }
        }
    }
    
    function showKeyPressedFeedback(element, key) {
        const feedback = document.createElement('div');
        feedback.className = 'key-pressed-feedback key-pressed-feedback key-pressed-feedback';
        feedback.textContent = key.toUpperCase();
        
        const rect = element.getBoundingClientRect();
        feedback.style.left = (rect.left + rect.width / 2) + 'px';
        feedback.style.top = (rect.top - 30) + 'px';
        
        feedback.style.cssText += `
            position: fixed !important;
            z-index: 2147483645 !important;
            pointer-events: none !important;
            display: block !important;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 1000);
    }
    
    function generateUniqueSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                const selector = `.${classes.join('.')}`;
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }
        
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            }
            
            if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    selector += `.${classes.join('.')}`;
                }
            }
            
            const siblings = Array.from(current.parentNode?.children || []);
            const index = siblings.indexOf(current);
            if (index > 0) {
                selector += `:nth-child(${index + 1})`;
            }
            
            path.unshift(selector);
            current = current.parentNode;
        }
        
        return path.join(' > ');
    }
    
    function getElementDescription(element) {
        let description = element.tagName.toLowerCase();
        
        if (element.id) {
            description += `#${element.id}`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2);
            if (classes.length > 0) {
                description += `.${classes.join('.')}`;
            }
        }
        
        const text = element.textContent?.trim().substring(0, 30);
        if (text) {
            description += ` "${text}${text.length > 30 ? '...' : ''}"`;
        }
        
        return description;
    }
    
    function loadKeyBindings() {
        chrome.runtime.sendMessage({type: 'GET_TAB_ID'}, function(response) {
            if (response?.tabId) {
                const tabKey = `bindings_${response.tabId}`;
                chrome.storage.local.get([tabKey], function(result) {
                    keyBindings = result[tabKey] || {};
                    console.log('Element Key Binder: Loaded key bindings:', keyBindings);
                });
            }
        });
    }
    
    function saveKeyBindings() {
        chrome.runtime.sendMessage({type: 'GET_TAB_ID'}, function(response) {
            if (response?.tabId) {
                const tabKey = `bindings_${response.tabId}`;
                chrome.storage.local.set({[tabKey]: keyBindings});
            }
        });
    }
    
    function showInstructionOverlay() {
        hideInstructionOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'key-binder-instruction';
        overlay.className = 'key-binder-instruction key-binder-instruction key-binder-instruction';
        overlay.innerHTML = `
            <div class="instruction-content instruction-content instruction-content">
                <div class="instruction-text instruction-text instruction-text">
                    🎯 Click on any element to assign a key
                </div>
                <div class="instruction-subtext instruction-subtext instruction-subtext">
                    Press ESC to cancel
                </div>
            </div>
        `;
        
        overlay.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 2147483646 !important;
            pointer-events: none !important;
            display: block !important;
        `;
        
        document.body.appendChild(overlay);
        console.log('Element Key Binder: Instruction overlay shown');
        
        document.addEventListener('keydown', function escHandler(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                stopElementSelection();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }
    
    function hideInstructionOverlay() {
        const overlay = document.getElementById('key-binder-instruction');
        if (overlay) {
            overlay.parentNode.removeChild(overlay);
        }
    }
})();
