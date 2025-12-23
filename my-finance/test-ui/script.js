// Configuration
let ML_SERVICE_URL = 'http://localhost:3005';
let TRANSACTION_SERVICE_URL = 'http://localhost:3001';

// Update URLs from inputs
document.getElementById('mlServiceUrl').addEventListener('change', (e) => {
    ML_SERVICE_URL = e.target.value;
});

document.getElementById('transactionServiceUrl').addEventListener('change', (e) => {
    TRANSACTION_SERVICE_URL = e.target.value;
});

// Set default datetime to now
document.getElementById('txDateTime').value = new Date().toISOString().slice(0, 16);

// Example chips click handler for category prediction
document.querySelectorAll('.example-chip[data-note]').forEach(chip => {
    chip.addEventListener('click', () => {
        const note = chip.getAttribute('data-note');
        const amount = chip.getAttribute('data-amount');
        document.getElementById('note').value = note;
        document.getElementById('amount').value = amount;
    });
});

// Example chips click handler for amount extraction
document.querySelectorAll('.example-chip[data-extract]').forEach(chip => {
    chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-extract');
        document.getElementById('extractText').value = text;
    });
});

// Example chips click handler for combined analysis
document.querySelectorAll('.example-chip[data-analyze]').forEach(chip => {
    chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-analyze');
        document.getElementById('analyzeText').value = text;
    });
});

// Combined Analysis Form Handler
document.getElementById('analyzeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('analyzeText').value;

    const loading = document.getElementById('analyzeLoading');
    const resultContainer = document.getElementById('analyzeResultContainer');
    const analyzeBtn = document.getElementById('analyzeBtn');

    // Show loading
    loading.classList.add('active');
    resultContainer.innerHTML = '';
    analyzeBtn.disabled = true;

    try {
        const response = await fetch(`${ML_SERVICE_URL}/analyze-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayCombinedAnalysisResult(data, resultContainer);

    } catch (error) {
        resultContainer.innerHTML = `
            <div class="error">
                <strong>❌ Lỗi:</strong> ${error.message}
                <br><br>
                <small>Kiểm tra xem ML Service có đang chạy tại ${ML_SERVICE_URL} không?</small>
            </div>
        `;
    } finally {
        loading.classList.remove('active');
        analyzeBtn.disabled = false;
    }
});

// Display Combined Analysis Result
function displayCombinedAnalysisResult(data, container) {
    const amountFormatted = data.amount.toLocaleString('vi-VN');
    const amountConfidencePercent = (data.amountConfidence * 100).toFixed(1);
    const categoryConfidencePercent = (data.categoryConfidence * 100).toFixed(1);
    const categoryEmoji = getCategoryEmoji(data.category);

    const amountConfidenceColor = data.amountConfidence >= 0.8 ? '#10b981' :
                                  data.amountConfidence >= 0.5 ? '#f59e0b' : '#ef4444';

    const methodLabels = {
        'regex-complex-vietnamese': 'Phức hợp (triệu + nghìn)',
        'regex-trieu': 'Triệu',
        'regex-tram-nghin': 'Trăm nghìn',
        'regex-nghin': 'Nghìn/Ngàn',
        'regex-k-notation': 'Ký hiệu k/K',
        'regex-plain-number': 'Số thuần',
        'empty-text': 'Văn bản trống',
        'not-found': 'Không tìm thấy',
        'invalid-format': 'Định dạng không hợp lệ',
        'no-match': 'Không khớp'
    };

    let suggestionsHtml = '';
    if (data.suggestions && data.suggestions.length > 0) {
        suggestionsHtml = `
            <div class="suggestions">
                <strong>Các gợi ý category khác:</strong>
                ${data.suggestions.slice(0, 5).map(s => `
                    <div class="suggestion-item">
                        <span class="suggestion-category">${getCategoryEmoji(s.category)} ${s.category}</span>
                        <span class="suggestion-confidence">${(s.confidence * 100).toFixed(1)}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="result-container">
            <h3>✨ Kết quả phân tích giao dịch</h3>

            <!-- Amount Section -->
            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="color: #667eea; margin: 0;">💰 Số tiền</h4>
                </div>

                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 2.5rem; font-weight: 700; color: #667eea;">
                        ${amountFormatted} ₫
                    </div>
                    ${data.matchedText ? `
                        <div style="font-size: 0.9rem; color: #999; margin-top: 5px;">
                            Văn bản khớp: "<strong>${data.matchedText}</strong>"
                        </div>
                    ` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Độ tin cậy</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: ${amountConfidenceColor};">
                            ${amountConfidencePercent}%
                        </div>
                        <div class="progress-bar" style="margin-top: 8px;">
                            <div class="progress-fill" style="width: ${amountConfidencePercent}%; background: ${amountConfidenceColor};"></div>
                        </div>
                    </div>

                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Phương pháp</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #333;">
                            ${methodLabels[data.extractionMethod] || data.extractionMethod}
                        </div>
                    </div>
                </div>

                ${data.amount === 0 ? `
                    <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <strong>⚠️ Lưu ý:</strong> Không tìm thấy số tiền trong văn bản.
                    </div>
                ` : ''}
            </div>

            <!-- Category Section -->
            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="color: #667eea; margin: 0;">🔖 Category</h4>
                </div>

                <div class="prediction-result">
                    <div class="category-badge">
                        ${categoryEmoji} ${data.category.toUpperCase()}
                    </div>
                    <div class="confidence-bar">
                        <div class="confidence-label">Độ tin cậy: ${categoryConfidencePercent}%</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${categoryConfidencePercent}%"></div>
                        </div>
                    </div>
                </div>

                ${suggestionsHtml}

                <div style="margin-top: 15px; font-size: 0.9rem; color: #666;">
                    <strong>Model:</strong> ${data.model}
                </div>
            </div>

            <div style="margin-top: 15px; padding: 15px; background: #e8f4f8; border-radius: 8px; font-size: 0.9rem;">
                <strong>🎯 Tóm tắt:</strong> Đã phân tích thành công giao dịch với số tiền
                <strong>${amountFormatted} ₫</strong> và category <strong>${categoryEmoji} ${data.category}</strong>
            </div>
        </div>
    `;
}

// Amount Extraction Form Handler
document.getElementById('extractForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('extractText').value;

    const loading = document.getElementById('extractLoading');
    const resultContainer = document.getElementById('extractResultContainer');
    const extractBtn = document.getElementById('extractBtn');

    // Show loading
    loading.classList.add('active');
    resultContainer.innerHTML = '';
    extractBtn.disabled = true;

    try {
        const response = await fetch(`${ML_SERVICE_URL}/extract-amount`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayExtractionResult(data, resultContainer);

    } catch (error) {
        resultContainer.innerHTML = `
            <div class="error">
                <strong>❌ Lỗi:</strong> ${error.message}
                <br><br>
                <small>Kiểm tra xem ML Service có đang chạy tại ${ML_SERVICE_URL} không?</small>
            </div>
        `;
    } finally {
        loading.classList.remove('active');
        extractBtn.disabled = false;
    }
});

// Display Extraction Result
function displayExtractionResult(data, container) {
    const confidencePercent = (data.confidence * 100).toFixed(1);
    const amountFormatted = data.amount.toLocaleString('vi-VN');

    const confidenceColor = data.confidence >= 0.8 ? '#10b981' :
                           data.confidence >= 0.5 ? '#f59e0b' : '#ef4444';

    const methodLabels = {
        'regex-complex-vietnamese': 'Phức hợp (triệu + nghìn)',
        'regex-trieu': 'Triệu',
        'regex-tram-nghin': 'Trăm nghìn',
        'regex-nghin': 'Nghìn/Ngàn',
        'regex-k-notation': 'Ký hiệu k/K',
        'regex-plain-number': 'Số thuần',
        'empty-text': 'Văn bản trống',
        'not-found': 'Không tìm thấy',
        'invalid-format': 'Định dạng không hợp lệ',
        'no-match': 'Không khớp'
    };

    container.innerHTML = `
        <div class="result-container">
            <h3>💰 Kết quả trích xuất</h3>

            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 15px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 3rem; font-weight: 700; color: #667eea;">
                        ${amountFormatted} ₫
                    </div>
                    ${data.matchedText ? `
                        <div style="font-size: 0.9rem; color: #999; margin-top: 5px;">
                            Văn bản khớp: "<strong>${data.matchedText}</strong>"
                        </div>
                    ` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Độ tin cậy</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: ${confidenceColor};">
                            ${confidencePercent}%
                        </div>
                        <div class="progress-bar" style="margin-top: 8px;">
                            <div class="progress-fill" style="width: ${confidencePercent}%; background: ${confidenceColor};"></div>
                        </div>
                    </div>

                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Phương pháp</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: #333;">
                            ${methodLabels[data.method] || data.method}
                        </div>
                    </div>
                </div>

                ${data.amount === 0 ? `
                    <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <strong>⚠️ Lưu ý:</strong> Không tìm thấy số tiền trong văn bản. Giá trị mặc định là 0.
                    </div>
                ` : ''}
            </div>

            <div style="margin-top: 15px; padding: 12px; background: #e8f4f8; border-radius: 8px; font-size: 0.9rem;">
                <strong>💡 Mẹo:</strong> Hỗ trợ các định dạng:
                <code>50000</code>, <code>50k</code>, <code>50 nghìn</code>,
                <code>1.5 triệu</code>, <code>2 trăm nghìn</code>,
                <code>1 triệu 500 nghìn</code>
            </div>
        </div>
    `;
}

// Predict Category Form Handler
document.getElementById('predictForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const note = document.getElementById('note').value;
    const amount = document.getElementById('amount').value;

    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('resultContainer');
    const predictBtn = document.getElementById('predictBtn');

    // Show loading
    loading.classList.add('active');
    resultContainer.innerHTML = '';
    predictBtn.disabled = true;

    try {
        const response = await fetch(`${ML_SERVICE_URL}/predict-category`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                note,
                amount: amount ? parseFloat(amount) : undefined,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayPredictionResult(data, resultContainer);

    } catch (error) {
        resultContainer.innerHTML = `
            <div class="error">
                <strong>❌ Lỗi:</strong> ${error.message}
                <br><br>
                <small>Kiểm tra xem ML Service có đang chạy tại ${ML_SERVICE_URL} không?</small>
            </div>
        `;
    } finally {
        loading.classList.remove('active');
        predictBtn.disabled = false;
    }
});

// Display Prediction Result
function displayPredictionResult(data, container) {
    const confidencePercent = (data.confidence * 100).toFixed(1);
    const categoryEmoji = getCategoryEmoji(data.category);

    let suggestionsHtml = '';
    if (data.suggestions && data.suggestions.length > 0) {
        suggestionsHtml = `
            <div class="suggestions">
                <strong>Các gợi ý khác:</strong>
                ${data.suggestions.slice(0, 5).map(s => `
                    <div class="suggestion-item">
                        <span class="suggestion-category">${getCategoryEmoji(s.category)} ${s.category}</span>
                        <span class="suggestion-confidence">${(s.confidence * 100).toFixed(1)}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="result-container">
            <h3>✨ Kết quả dự đoán</h3>

            <div class="prediction-result">
                <div class="category-badge">
                    ${categoryEmoji} ${data.category.toUpperCase()}
                </div>
                <div class="confidence-bar">
                    <div class="confidence-label">Độ tin cậy: ${confidencePercent}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${confidencePercent}%"></div>
                    </div>
                </div>
            </div>

            ${suggestionsHtml}

            <div style="margin-top: 15px; font-size: 0.9rem; color: #666;">
                <strong>Model:</strong> ${data.model}
            </div>
        </div>
    `;
}

// Get emoji for category
function getCategoryEmoji(category) {
    const emojiMap = {
        'income': '💰',
        'food': '🍜',
        'transport': '🚗',
        'entertainment': '🎬',
        'shopping': '🛍️',
        'healthcare': '🏥',
        'education': '📚',
        'bills': '📄',
        'housing': '🏠',
        'personal': '👤',
        'other': '📦'
    };
    return emojiMap[category.toLowerCase()] || '📦';
}

// Auto-Suggest Button Handler (Extract Amount + Predict Category)
document.getElementById('autoSuggestBtn').addEventListener('click', async () => {
    const note = document.getElementById('txNote').value;
    let amount = document.getElementById('txAmount').value;

    if (!note || note.trim().length === 0) {
        alert('Vui lòng nhập mô tả giao dịch!');
        return;
    }

    const txLoading = document.getElementById('txLoading');
    const amountDisplay = document.getElementById('amountDisplay');
    const extractedAmount = document.getElementById('extractedAmount');
    const categoryDisplay = document.getElementById('categoryDisplay');
    const predictedCategory = document.getElementById('predictedCategory');
    const autoSuggestBtn = document.getElementById('autoSuggestBtn');

    txLoading.classList.add('active');
    autoSuggestBtn.disabled = true;

    try {
        // Step 1: Extract amount if not provided
        if (!amount) {
            const extractResponse = await fetch(`${ML_SERVICE_URL}/extract-amount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: note }),
            });

            if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                amount = extractData.amount;

                // Update amount display
                amountDisplay.classList.remove('empty');
                const amountFormatted = extractData.amount.toLocaleString('vi-VN');
                const confidencePercent = (extractData.confidence * 100).toFixed(1);

                extractedAmount.innerHTML = `
                    ${amountFormatted} ₫
                    <span style="font-size: 0.8rem; color: #999;">
                        (${confidencePercent}% - ${extractData.method})
                    </span>
                `;

                // Auto-fill amount field
                document.getElementById('txAmount').value = extractData.amount || '';
            }
        }

        // Step 2: Predict category
        const categoryResponse = await fetch(`${ML_SERVICE_URL}/predict-category`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                note,
                amount: amount ? parseFloat(amount) : undefined,
            }),
        });

        if (!categoryResponse.ok) {
            throw new Error(`HTTP error! status: ${categoryResponse.status}`);
        }

        const categoryData = await categoryResponse.json();

        const emoji = getCategoryEmoji(categoryData.category);
        const confidencePercent = (categoryData.confidence * 100).toFixed(1);

        categoryDisplay.classList.remove('empty');
        predictedCategory.innerHTML = `${emoji} ${categoryData.category.toUpperCase()} <span style="font-size: 0.8rem; color: #999;">(${confidencePercent}% confidence)</span>`;

    } catch (error) {
        alert('Lỗi khi gọi API: ' + error.message);
    } finally {
        txLoading.classList.remove('active');
        autoSuggestBtn.disabled = false;
    }
});

// Transaction Form Handler (Note: Requires authentication)
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const note = document.getElementById('txNote').value;
    const amount = document.getElementById('txAmount').value;
    const dateTime = document.getElementById('txDateTime').value;

    const txLoading = document.getElementById('txLoading');
    const txResultContainer = document.getElementById('txResultContainer');
    const createBtn = document.getElementById('createBtn');

    txLoading.classList.add('active');
    txResultContainer.innerHTML = '';
    createBtn.disabled = true;

    try {
        // Build request body - amount is optional
        const requestBody = {
            note,
            dateTime: new Date(dateTime).toISOString(),
            // Don't send category - let AI auto-predict
        };

        // Only include amount if provided
        if (amount) {
            requestBody.amount = parseFloat(amount);
        }

        const response = await fetch(`${TRANSACTION_SERVICE_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // NOTE: Cần JWT token thực tế để test với Transaction Service
                // 'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Chưa đăng nhập! Cần JWT token để tạo transaction.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const emoji = getCategoryEmoji(data.category);

        txResultContainer.innerHTML = `
            <div class="result-container">
                <h3>✅ Transaction đã được tạo</h3>
                <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <p><strong>ID:</strong> ${data.id}</p>
                    <p><strong>Amount:</strong> ${data.amount.toLocaleString('vi-VN')} VND</p>
                    <p><strong>Category:</strong> ${emoji} ${data.category}</p>
                    <p><strong>Note:</strong> ${data.note}</p>
                    <p><strong>DateTime:</strong> ${new Date(data.dateTime).toLocaleString('vi-VN')}</p>
                </div>
            </div>
        `;

        // Reset form
        document.getElementById('transactionForm').reset();
        document.getElementById('txDateTime').value = new Date().toISOString().slice(0, 16);
        document.getElementById('amountDisplay').classList.add('empty');
        document.getElementById('extractedAmount').textContent = 'Chưa trích xuất';
        document.getElementById('categoryDisplay').classList.add('empty');
        document.getElementById('predictedCategory').textContent = 'Chưa có dự đoán';

    } catch (error) {
        txResultContainer.innerHTML = `
            <div class="error">
                <strong>❌ Lỗi:</strong> ${error.message}
                <br><br>
                <small>
                    ${error.message.includes('JWT')
                        ? 'Để test endpoint này, bạn cần đăng nhập và thêm JWT token vào header Authorization.'
                        : `Kiểm tra xem Transaction Service có đang chạy tại ${TRANSACTION_SERVICE_URL} không?`
                    }
                </small>
            </div>
        `;
    } finally {
        txLoading.classList.remove('active');
        createBtn.disabled = false;
    }
});

// Multi-Transaction Analysis Handler
document.getElementById('multiAnalyzeBtn').addEventListener('click', async () => {
    const text = document.getElementById('multiInput').value;
    const multiLoading = document.getElementById('multiLoading');
    const multiResultContainer = document.getElementById('multiResultContainer');
    const multiAnalyzeBtn = document.getElementById('multiAnalyzeBtn');

    if (!text || text.trim().length === 0) {
        alert('Vui lòng nhập văn bản!');
        return;
    }

    multiLoading.classList.add('active');
    multiResultContainer.innerHTML = '';
    multiAnalyzeBtn.disabled = true;

    try {
        const response = await fetch(`${ML_SERVICE_URL}/analyze-multi-transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.count === 0) {
            multiResultContainer.innerHTML = `
                <div class="result-container">
                    <h3>⚠️ Không tìm thấy giao dịch</h3>
                    <p style="color: #666;">Không tìm thấy số tiền trong văn bản. Vui lòng thử lại với văn bản khác có chứa số tiền.</p>
                </div>
            `;
            return;
        }

        let resultsHtml = `
            <div class="result-container">
                <h3>✨ Tìm thấy ${data.count} giao dịch</h3>
        `;

        data.transactions.forEach((tx, index) => {
            const emoji = getCategoryEmoji(tx.category);
            const amountFormatted = tx.amount.toLocaleString('vi-VN');
            const amountConfidencePercent = (tx.amountConfidence * 100).toFixed(1);
            const categoryConfidencePercent = (tx.categoryConfidence * 100).toFixed(1);

            resultsHtml += `
                <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 15px; border-left: 5px solid #667eea;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="color: #667eea; margin: 0;">📌 Giao dịch #${index + 1}</h4>
                    </div>

                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Câu được phân tích:</div>
                        <div style="font-size: 1rem; color: #333; font-style: italic;">
                            "${tx.sentence}"
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px;">
                            <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">💰 Số tiền</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #2e7d32;">
                                ${amountFormatted} ₫
                            </div>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 5px;">
                                ${tx.matchedText ? `"${tx.matchedText}"` : ''} (${amountConfidencePercent}%)
                            </div>
                        </div>

                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px;">
                            <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">🔖 Category</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #1565c0;">
                                ${emoji} ${tx.category.toUpperCase()}
                            </div>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 5px;">
                                ${categoryConfidencePercent}% confidence
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        resultsHtml += `
                <div style="margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 8px;">
                    <strong>📊 Tổng kết:</strong> Tìm thấy <strong>${data.count}</strong> giao dịch với tổng số tiền
                    <strong>${data.transactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString('vi-VN')} ₫</strong>
                </div>
            </div>
        `;

        multiResultContainer.innerHTML = resultsHtml;

    } catch (error) {
        multiResultContainer.innerHTML = `
            <div class="error">
                <strong>❌ Lỗi:</strong> ${error.message}
                <br><br>
                <small>Kiểm tra xem ML Service có đang chạy tại ${ML_SERVICE_URL} không?</small>
            </div>
        `;
    } finally {
        multiLoading.classList.remove('active');
        multiAnalyzeBtn.disabled = false;
    }
});

// Batch Prediction Handler
document.getElementById('batchPredictBtn').addEventListener('click', async () => {
    const batchInput = document.getElementById('batchInput').value;
    const batchLoading = document.getElementById('batchLoading');
    const batchResultContainer = document.getElementById('batchResultContainer');
    const batchPredictBtn = document.getElementById('batchPredictBtn');

    batchLoading.classList.add('active');
    batchResultContainer.innerHTML = '';
    batchPredictBtn.disabled = true;

    try {
        const items = JSON.parse(batchInput);

        if (!Array.isArray(items)) {
            throw new Error('Input phải là JSON array!');
        }

        const response = await fetch(`${ML_SERVICE_URL}/batch-predict-category`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(items),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const results = await response.json();

        let resultsHtml = '<div class="result-container"><h3>📊 Batch Prediction Results</h3>';

        results.forEach((result, index) => {
            const emoji = getCategoryEmoji(result.category);
            const confidencePercent = (result.confidence * 100).toFixed(1);

            resultsHtml += `
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>#${index + 1}:</strong> ${items[index].note}
                            <br>
                            <span style="color: #666; font-size: 0.9rem;">Amount: ${items[index].amount?.toLocaleString('vi-VN')} VND</span>
                        </div>
                        <div style="text-align: right;">
                            <div class="category-badge" style="display: inline-block;">
                                ${emoji} ${result.category}
                            </div>
                            <div style="color: #667eea; font-size: 0.9rem; margin-top: 5px;">
                                ${confidencePercent}% confidence
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        resultsHtml += '</div>';
        batchResultContainer.innerHTML = resultsHtml;

    } catch (error) {
        batchResultContainer.innerHTML = `
            <div class="error">
                <strong>❌ Lỗi:</strong> ${error.message}
                <br><br>
                <small>Kiểm tra format JSON và xem ML Service có đang chạy không?</small>
            </div>
        `;
    } finally {
        batchLoading.classList.remove('active');
        batchPredictBtn.disabled = false;
    }
});
