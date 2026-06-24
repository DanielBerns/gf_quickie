document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const keysContainer = document.getElementById('category-keys');
    const breadcrumbEl = document.getElementById('category-breadcrumb');
    const hiddenInput = document.getElementById('category');
    const keyboardArea = document.getElementById('category-keyboard-area');
    const selectedContainer = document.getElementById('selected-category-container');
    const selectedText = document.getElementById('selected-category-text');
    const resetBtn = document.getElementById('reset-category-btn');

    // State
    let currentPath = [];
    let currentNode = typeof categoryWordTree !== 'undefined' ? categoryWordTree : {};

    function renderKeyboard() {
        keysContainer.innerHTML = '';

        // Update Breadcrumb
        breadcrumbEl.textContent = currentPath.length > 0
        ? `Ruta: ${currentPath.join(' > ')}`
        : 'Seleccione una categoría principal...';

        // Render Back Button if deep in the tree
        if (currentPath.length > 0) {
            const backBtn = document.createElement('button');
            backBtn.textContent = '← Volver';
            backBtn.type = 'button'; // Prevent form submission
            backBtn.className = 'category-btn category-btn-full';
            backBtn.style.backgroundColor = '#f8d7da';
            backBtn.style.borderColor = '#f5c6cb';
            backBtn.style.color = '#721c24';
            backBtn.onclick = handleBack;
            keysContainer.appendChild(backBtn);
        }

        // Render Current Options
        const options = Object.keys(currentNode);
        options.forEach(word => {
            const btn = document.createElement('button');
            btn.textContent = word;
            btn.type = 'button'; // Prevent form submission
            btn.className = 'category-btn';
            btn.onclick = () => handleSelection(word);
            keysContainer.appendChild(btn);
        });
    }

    function handleSelection(word) {
        currentPath.push(word);
        const nextNode = currentNode[word];

        // If the next node is a string, it's a leaf containing the actual category value
        if (typeof nextNode === 'string') {
            setCategory(nextNode, currentPath.join(' > '));
        } else {
            // Otherwise, navigate deeper into the object
            currentNode = nextNode;
            renderKeyboard();
        }
    }

    function handleBack() {
        currentPath.pop();

        // Re-traverse from the root to find the new current node
        currentNode = categoryWordTree;
        for (const word of currentPath) {
            currentNode = currentNode[word];
        }
        renderKeyboard();
    }

    function setCategory(value, displayPath) {
        // Set the hidden input value for form submission
        hiddenInput.value = value;

        // Update UI to show selected path
        selectedText.textContent = displayPath;
        keyboardArea.classList.add('hidden');
        selectedContainer.classList.remove('hidden');
    }

    // Reset flow
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            hiddenInput.value = '';
            currentPath = [];
            currentNode = categoryWordTree;

            selectedContainer.classList.add('hidden');
            keyboardArea.classList.remove('hidden');
            renderKeyboard();
        });
    }

    // Initialize the keyboard on load
    if (keysContainer && Object.keys(currentNode).length > 0) {
        renderKeyboard();
    }
});
