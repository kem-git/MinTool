const display = document.getElementById('display');

// Set initial value to 0
display.value = '0';

function appendToDisplay(input) {
    // Prevent multiple decimals in a number
    if (input === '.' && display.value.split(/\+|\-|\*|\//).pop().includes('.')) {
        return;
    }
    // Replace initial 0 unless input is '.'
    if (display.value === '0' && input !== '.') {
        display.value = input;
    } else {
        display.value += input;
    }
}

function clearDisplay() {
    display.value = '0';
}

function calculateResult() {
    try {
        // Replace x with * for multiplication
        let expression = display.value.replace(/x/g, '*');
        let result = eval(expression);
        display.value = result.toString();
    } catch (e) {
        display.value = 'Error';
    }
}

// Keyboard support
document.addEventListener('keydown', (event) => {
    const key = event.key;

    if (!isNaN(key)) {
        // Numbers 0–9
        appendToDisplay(key);
    } else if (['+', '-', '*', '/'].includes(key)) {
        appendToDisplay(key);
    } else if (key === '.') {
        appendToDisplay('.');
    } else if (key === 'Enter' || key === '=') {
        calculateResult();
    } else if (key === 'Backspace') {
        // Remove last char
        display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0';
    } else if (key.toLowerCase() === 'c') {
        clearDisplay();
    }
});
