document.addEventListener('DOMContentLoaded', () => {
    const deviceIdInput = document.getElementById('deviceId');
    const creditsInput = document.getElementById('credits');
    const generateBtn = document.getElementById('generateBtn');
    const resultContainer = document.getElementById('resultContainer');
    const generatedKeyEl = document.getElementById('generatedKey');
    const copyFeedbackEl = document.getElementById('copyFeedback');

    /**
     * Generates the validation hash from a device ID.
     * This MUST match the logic in the main application (index.tsx).
     * @param {string} deviceId The user's unique device ID.
     * @returns {string} The validation hash.
     */
    const generateValidationHash = (deviceId) => {
        if (!deviceId || typeof deviceId !== 'string') return '';
        return deviceId.split('').reverse().join('').substring(0, 8).toUpperCase();
    };

    const handleGenerateClick = () => {
        const deviceId = deviceIdInput.value.trim();
        const credits = parseInt(creditsInput.value, 10);

        if (!deviceId) {
            alert('Please enter a Device ID.');
            return;
        }
        if (isNaN(credits) || credits <= 0) {
            alert('Please enter a valid number of credits.');
            return;
        }

        const hash = generateValidationHash(deviceId);
        const finalKey = `UNLOCK-${credits}-${hash}`;

        generatedKeyEl.textContent = finalKey;
        resultContainer.style.display = 'block';
    };

    const handleKeyClickToCopy = () => {
        const key = generatedKeyEl.textContent;
        if (!key) return;

        navigator.clipboard.writeText(key).then(() => {
            copyFeedbackEl.style.opacity = '1';
            setTimeout(() => {
                copyFeedbackEl.style.opacity = '0';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy key. Please copy it manually.');
        });
    };

    generateBtn.addEventListener('click', handleGenerateClick);
    generatedKeyEl.addEventListener('click', handleKeyClickToCopy);
});
