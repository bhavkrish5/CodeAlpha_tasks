/**
 * Modern Responsive Calculator Application Engine
 * Pure Vanilla JavaScript - Standard Infix Safe Evaluation (No eval)
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. Application State & DOM References
  // =========================================================================
  const state = {
    currentInput: '0',       // Active entry displayed on screen
    previousInput: '',       // Left operand for pending binary operation
    operator: null,          // Current active pending operator ('+', '−', '×', '÷')
    expression: '',          // Full expression text string for upper screen line
    shouldResetInput: false, // Flag set after operator or equals is pressed
    isErrorState: false,     // Flag when error occurs (e.g. division by zero)
    history: []              // Log of past calculation objects { expr, result }
  };

  // DOM Elements
  const resultDisplay = document.getElementById('result');
  const expressionDisplay = document.getElementById('expression');
  const keypad = document.getElementById('keypad');
  const displayContainer = document.getElementById('displayContainer');
  const copyBtn = document.getElementById('copyBtn');

  // Drawer & Modal Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const historyDrawer = document.getElementById('historyDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');

  const shortcutsBtn = document.getElementById('shortcutsBtn');
  const shortcutsModal = document.getElementById('shortcutsModal');
  const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');
  const toast = document.getElementById('toast');

  // Available Themes
  const themes = ['dark', 'light', 'neon'];
  let currentThemeIndex = 0;

  // =========================================================================
  // 2. Calculator Core Operations & Safe Calculation Engine
  // =========================================================================

  /**
   * Safely calculates basic binary arithmetic operations.
   * Prevents division by zero and handles floating point precision errors.
   * @param {string} aStr First operand
   * @param {string} op Operator (+, −, ×, ÷)
   * @param {string} bStr Second operand
   * @returns {number|string} Calculated numerical result or error string
   */
  function safeCalculate(aStr, op, bStr) {
    const a = parseFloat(aStr);
    const b = parseFloat(bStr);

    if (isNaN(a) || isNaN(b)) return 0;

    let rawResult = 0;
    switch (op) {
      case '+':
        rawResult = a + b;
        break;
      case '−':
      case '-':
        rawResult = a - b;
        break;
      case '×':
      case '*':
        rawResult = a * b;
        break;
      case '÷':
      case '/':
        if (b === 0) {
          return 'Cannot divide by 0';
        }
        rawResult = a / b;
        break;
      default:
        return b;
    }

    // Clean floating-point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004)
    return roundPrecision(rawResult);
  }

  /**
   * Helper to round floating-point results cleanly up to 10 decimal places.
   * Removes unnecessary trailing zeros.
   * @param {number} num 
   * @returns {number}
   */
  function roundPrecision(num) {
    if (typeof num !== 'number' || !isFinite(num)) return num;
    // Fix JS float precision
    return Number(Math.round(parseFloat(num + 'e12')) + 'e-12');
  }

  // =========================================================================
  // 3. User Action Handlers
  // =========================================================================

  /**
   * Handles digit input (0–9)
   * @param {string} digit 
   */
  function handleDigit(digit) {
    if (state.isErrorState) {
      resetCalculator();
    }

    if (state.shouldResetInput) {
      state.currentInput = digit;
      state.shouldResetInput = false;
    } else {
      if (state.currentInput === '0') {
        state.currentInput = digit;
      } else {
        // Limit digit length to 16 to avoid display overflow
        if (state.currentInput.replace('-', '').replace('.', '').length < 16) {
          state.currentInput += digit;
        }
      }
    }
    updateDisplay();
  }

  /**
   * Handles decimal point (.)
   */
  function handleDecimal() {
    if (state.isErrorState) {
      resetCalculator();
    }

    if (state.shouldResetInput) {
      state.currentInput = '0.';
      state.shouldResetInput = false;
    } else if (!state.currentInput.includes('.')) {
      state.currentInput += '.';
    }
    updateDisplay();
  }

  /**
   * Handles binary operators (+, −, ×, ÷)
   * @param {string} op 
   */
  function handleOperator(op) {
    if (state.isErrorState) return;

    // Normalize operator symbol
    const normalizedOp = op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;

    // If an operator is already active and user has entered a new number, execute step first
    if (state.operator && !state.shouldResetInput) {
      const stepResult = safeCalculate(state.previousInput, state.operator, state.currentInput);

      if (typeof stepResult === 'string') {
        // Division by zero or error
        state.currentInput = stepResult;
        state.isErrorState = true;
        state.expression = `${state.previousInput} ${state.operator} ${state.currentInput} =`;
        state.operator = null;
        updateDisplay();
        return;
      }

      state.currentInput = String(stepResult);
      state.previousInput = String(stepResult);
    } else {
      state.previousInput = state.currentInput;
    }

    state.operator = normalizedOp;
    state.shouldResetInput = true;
    state.expression = `${formatNumber(state.previousInput)} ${state.operator}`;

    highlightActiveOperatorButton(normalizedOp);
    updateDisplay();
  }

  /**
   * Performs main calculation (= button or Enter key)
   */
  function handleCalculate() {
    if (state.isErrorState || !state.operator || state.previousInput === '') return;

    const val1 = state.previousInput;
    const op = state.operator;
    const val2 = state.currentInput;

    const result = safeCalculate(val1, op, val2);

    if (typeof result === 'string') {
      // Error state (e.g. division by zero)
      state.currentInput = result;
      state.isErrorState = true;
      state.expression = `${formatNumber(val1)} ${op} ${formatNumber(val2)} =`;
      state.operator = null;
    } else {
      const formattedResult = String(result);
      const fullExpr = `${formatNumber(val1)} ${op} ${formatNumber(val2)} =`;

      // Save calculation to history
      saveHistory(fullExpr, formattedResult);

      state.expression = fullExpr;
      state.currentInput = formattedResult;
      state.previousInput = formattedResult;
      state.operator = null;
      state.shouldResetInput = true;
    }

    clearActiveOperatorHighlight();
    updateDisplay();
  }

  /**
   * Backspace button (⌫)
   */
  function handleBackspace() {
    if (state.isErrorState) {
      resetCalculator();
      return;
    }

    if (state.shouldResetInput) return;

    if (state.currentInput.length > 1) {
      state.currentInput = state.currentInput.slice(0, -1);
      // Handle negative single digit remainder
      if (state.currentInput === '-') {
        state.currentInput = '0';
      }
    } else {
      state.currentInput = '0';
    }
    updateDisplay();
  }

  /**
   * Clear All / Reset Calculator (AC)
   */
  function resetCalculator() {
    state.currentInput = '0';
    state.previousInput = '';
    state.operator = null;
    state.expression = '';
    state.shouldResetInput = false;
    state.isErrorState = false;
    clearActiveOperatorHighlight();
    updateDisplay();
  }

  /**
   * Percentage (%) function
   */
  function handlePercent() {
    if (state.isErrorState) return;

    const num = parseFloat(state.currentInput);
    if (isNaN(num)) return;

    let res = 0;
    if (state.operator && state.previousInput) {
      // If inside an expression like 100 + 10%, calculate 10% of 100
      const prev = parseFloat(state.previousInput);
      res = (prev * num) / 100;
    } else {
      // Standalone number percentage
      res = num / 100;
    }

    state.currentInput = String(roundPrecision(res));
    updateDisplay();
  }

  /**
   * Toggle Sign (±)
   */
  function handleToggleSign() {
    if (state.isErrorState || state.currentInput === '0') return;

    if (state.currentInput.startsWith('-')) {
      state.currentInput = state.currentInput.substring(1);
    } else {
      state.currentInput = '-' + state.currentInput;
    }
    updateDisplay();
  }

  /**
   * Square Root (√x)
   */
  function handleSqrt() {
    if (state.isErrorState) return;

    const num = parseFloat(state.currentInput);
    if (isNaN(num) || num < 0) {
      state.currentInput = 'Invalid Input';
      state.isErrorState = true;
    } else {
      const res = roundPrecision(Math.sqrt(num));
      state.expression = `√(${formatNumber(state.currentInput)}) =`;
      state.currentInput = String(res);
      state.shouldResetInput = true;
    }
    updateDisplay();
  }

  /**
   * Square (x²)
   */
  function handleSquare() {
    if (state.isErrorState) return;

    const num = parseFloat(state.currentInput);
    if (isNaN(num)) return;

    const res = roundPrecision(num * num);
    state.expression = `sqr(${formatNumber(state.currentInput)}) =`;
    state.currentInput = String(res);
    state.shouldResetInput = true;
    updateDisplay();
  }

  // =========================================================================
  // 4. UI Display & Formatting Logic
  // =========================================================================

  /**
   * Formats a raw number string with localized commas for visual readability.
   * @param {string} numStr 
   * @returns {string}
   */
  function formatNumber(numStr) {
    if (!numStr || numStr === 'Cannot divide by 0' || numStr === 'Invalid Input') {
      return numStr;
    }

    const parts = numStr.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Handle negative sign separately during formatting
    let prefix = '';
    if (integerPart.startsWith('-')) {
      prefix = '-';
      integerPart = integerPart.substring(1);
    }

    // Add thousands commas
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return prefix + formattedInteger + decimalPart;
  }

  /**
   * Updates main display screen lines and dynamically adjusts font size
   */
  function updateDisplay() {
    // Upper expression display
    expressionDisplay.textContent = state.expression;

    // Main result display
    if (state.isErrorState) {
      resultDisplay.textContent = state.currentInput;
      resultDisplay.style.fontSize = '1.6rem';
      resultDisplay.style.color = '#ef4444';
      return;
    }

    resultDisplay.style.color = 'var(--text-main)';
    const formatted = formatNumber(state.currentInput);
    resultDisplay.textContent = formatted;

    // Dynamic Font Scaling based on text length
    const len = formatted.length;
    if (len > 14) {
      resultDisplay.style.fontSize = '1.4rem';
    } else if (len > 10) {
      resultDisplay.style.fontSize = '1.8rem';
    } else if (len > 7) {
      resultDisplay.style.fontSize = '2.1rem';
    } else {
      resultDisplay.style.fontSize = '2.5rem';
    }
  }

  /**
   * Highlights operator button visually when active
   */
  function highlightActiveOperatorButton(opSymbol) {
    clearActiveOperatorHighlight();
    const opBtns = document.querySelectorAll('.btn-operator');
    opBtns.forEach(btn => {
      if (btn.dataset.value === opSymbol) {
        btn.classList.add('active-op');
      }
    });
  }

  function clearActiveOperatorHighlight() {
    document.querySelectorAll('.btn-operator').forEach(btn => btn.classList.remove('active-op'));
  }

  // =========================================================================
  // 5. History Drawer & Local Persistence
  // =========================================================================

  function saveHistory(expr, result) {
    state.history.unshift({ expr, result });
    if (state.history.length > 25) {
      state.history.pop();
    }
    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      historyList.innerHTML = `<div class="empty-history">No calculations recorded yet.</div>`;
      return;
    }

    historyList.innerHTML = state.history.map((item, idx) => `
      <div class="history-item" data-index="${idx}">
        <div class="history-expr">${item.expr}</div>
        <div class="history-res">${formatNumber(item.result)}</div>
      </div>
    `).join('');
  }

  // Recall history item on click
  historyList.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.history-item');
    if (!itemEl) return;

    const idx = parseInt(itemEl.dataset.index, 10);
    const item = state.history[idx];
    if (item) {
      state.currentInput = item.result;
      state.shouldResetInput = true;
      state.isErrorState = false;
      updateDisplay();
      closeDrawer();
      showToast('Loaded result from history!');
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    state.history = [];
    renderHistory();
    showToast('History cleared');
  });

  // Drawer Controls
  function openDrawer() {
    historyDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
  }

  function closeDrawer() {
    historyDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
  }

  historyToggleBtn.addEventListener('click', openDrawer);
  closeHistoryBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  // =========================================================================
  // 6. Keyboard Support & Physical Key Mapping
  // =========================================================================

  document.addEventListener('keydown', (e) => {
    // If modal or input element is focused, avoid overriding default keys
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;

    // Prevent default scrolling for Space/Slash/Enter
    if (['/', 'Enter', '='].includes(key)) {
      e.preventDefault();
    }

    let targetBtn = null;

    if (key >= '0' && key <= '9') {
      handleDigit(key);
      targetBtn = document.querySelector(`.btn-number[data-value="${key}"]`);
    } else if (key === '.' || key === ',') {
      handleDecimal();
      targetBtn = document.getElementById('btn-decimal');
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      handleOperator(key);
      const dataKey = key === '*' ? '*' : key === '/' ? '/' : key === '-' ? '-' : '+';
      targetBtn = document.querySelector(`.btn-operator[data-key="${dataKey}"]`);
    } else if (key === 'Enter' || key === '=') {
      handleCalculate();
      targetBtn = document.getElementById('btn-equals');
    } else if (key === 'Backspace') {
      handleBackspace();
      targetBtn = document.getElementById('btn-backspace');
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      resetCalculator();
      targetBtn = document.getElementById('btn-clear');
    } else if (key === '%') {
      handlePercent();
      targetBtn = document.getElementById('btn-percent');
    }

    // Flash active key press styling on corresponding UI button
    if (targetBtn) {
      targetBtn.classList.add('key-pressed');
      setTimeout(() => targetBtn.classList.remove('key-pressed'), 150);
    }
  });

  // =========================================================================
  // 7. Keypad Mouse/Touch Click Events (Delegation)
  // =========================================================================

  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    if (value && !action) {
      // Number digit or decimal
      if (value === '.') {
        handleDecimal();
      } else {
        handleDigit(value);
      }
    } else if (action) {
      switch (action) {
        case 'operator':
          handleOperator(value);
          break;
        case 'calculate':
          handleCalculate();
          break;
        case 'clear':
          resetCalculator();
          break;
        case 'backspace':
          handleBackspace();
          break;
        case 'percent':
          handlePercent();
          break;
        case 'toggle-sign':
          handleToggleSign();
          break;
        case 'sqrt':
          handleSqrt();
          break;
        case 'square':
          handleSquare();
          break;
      }
    }
  });

  // =========================================================================
  // 8. Theme Switcher, Copy to Clipboard, & Modals
  // =========================================================================

  // Theme Toggler
  themeToggleBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const nextTheme = themes[currentThemeIndex];
    document.documentElement.setAttribute('data-theme', nextTheme);
    showToast(`Theme switched to ${nextTheme.toUpperCase()}`);
  });

  // Copy to Clipboard
  function copyResultToClipboard() {
    if (state.isErrorState) return;
    const textToCopy = state.currentInput;
    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast('Copied result to clipboard!'))
      .catch(() => showToast('Failed to copy'));
  }

  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyResultToClipboard();
  });
  displayContainer.addEventListener('click', copyResultToClipboard);

  // Keyboard Shortcuts Modal
  shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('active'));
  closeShortcutsBtn.addEventListener('click', () => shortcutsModal.classList.remove('active'));
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) shortcutsModal.classList.remove('active');
  });

  // Toast System
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // Initial Display Paint
  updateDisplay();
});
