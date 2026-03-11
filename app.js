class OrderProcessor {
    constructor() {
        this.files = new Map(); // 使用 Map 存储，key 为 "文件名+大小"，value 为 File 对象
        this.processedData = [];
        this.headerIndices = {};
        this.exchangeRates = {
            'GBP': 1.33,
            'USD': 1.00,
            'AUD': 0.70,
            'EUR': 1.15
        };
        this.currencies = ['GBP', 'USD', 'AUD', 'EUR'];
    }

    /**
     * 文件上传与校验
     */
    addFiles(fileList) {
        let addedCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;

        Array.from(fileList).forEach(file => {
            // 检查文件后缀
            if (!file.name.toLowerCase().endsWith('.xml')) {
                invalidCount++;
                return;
            }

            // 生成唯一标识：文件名+文件大小
            const fileKey = `${file.name}_${file.size}`;

            // 检查是否重复
            if (this.files.has(fileKey)) {
                duplicateCount++;
                return;
            }

            // 添加到文件列表
            this.files.set(fileKey, {
                file: file,
                status: 'pending',
                data: null
            });
            addedCount++;
        });

        return { addedCount, duplicateCount, invalidCount };
    }

    /**
     * XML 解析与表头定位
     */
    async parseXML(fileKey) {
        const fileData = this.files.get(fileKey);
        const file = fileData.file;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');

                    // 检查解析错误
                    const parseError = xmlDoc.querySelector('parsererror');
                    if (parseError) {
                        throw new Error('XML 解析失败');
                    }

                    // Excel XML 2003 结构：Workbook -> Worksheet -> Table -> Row
                    const workbook = xmlDoc.getElementsByTagName('Workbook')[0];
                    if (!workbook) {
                        throw new Error('不是有效的 Excel XML 格式');
                    }

                    const worksheet = workbook.getElementsByTagName('Worksheet')[0];
                    if (!worksheet) {
                        throw new Error('找不到 Worksheet 节点');
                    }

                    const table = worksheet.getElementsByTagName('Table')[0];
                    if (!table) {
                        throw new Error('找不到 Table 节点');
                    }

                    const rows = table.getElementsByTagName('Row');
                    if (rows.length < 2) {
                        throw new Error('数据行数不足');
                    }

                    // 解析表头（第一行）
                    const headerRow = rows[0];
                    const cells = headerRow.getElementsByTagName('Cell');
                    const headers = [];

                    for (let i = 0; i < cells.length; i++) {
                        const dataCell = cells[i].getElementsByTagName('Data')[0];
                        if (dataCell) {
                            headers.push(dataCell.textContent.trim());
                        }
                    }

                    // 检查必需字段
                    const requiredFields = ['eBay帐号', '站点', '货币', '总额', '付款日期'];
                    const missingFields = requiredFields.filter(field => !headers.includes(field));
                    
                    if (missingFields.length > 0) {
                        throw new Error(`缺少必需字段: ${missingFields.join(', ')}`);
                    }

                    // 记录表头索引
                    this.headerIndices = {
                        'eBay帐号': headers.indexOf('eBay帐号'),
                        '站点': headers.indexOf('站点'),
                        '货币': headers.indexOf('货币'),
                        '总额': headers.indexOf('总额'),
                        '付款日期': headers.indexOf('付款日期')
                    };

                    // 解析数据行（从第二行开始）
                    const data = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        const cells = row.getElementsByTagName('Cell');
                        const rowData = [];

                        for (let j = 0; j < cells.length; j++) {
                            const dataCell = cells[j].getElementsByTagName('Data')[0];
                            if (dataCell) {
                                rowData.push(dataCell.textContent.trim());
                            } else {
                                rowData.push('');
                            }
                        }
                        data.push(rowData);
                    }

                    fileData.data = data;
                    fileData.status = 'success';
                    resolve({ success: true, data: data, rowCount: data.length });

                } catch (error) {
                    fileData.status = 'error';
                    fileData.errorMessage = error.message;
                    resolve({ success: false, error: error.message });
                }
            };

            reader.onerror = () => {
                fileData.status = 'error';
                fileData.errorMessage = '文件读取失败';
                resolve({ success: false, error: '文件读取失败' });
            };

            reader.readAsText(file);
        });
    }

    /**
     * 核心数据清洗与转换
     */
    transformRow(rowData) {
        // 获取各字段值
        const ebayAccount = rowData[this.headerIndices['eBay帐号']] || '';
        const site = rowData[this.headerIndices['站点']] || '';
        const currency = rowData[this.headerIndices['货币']] || '';
        const totalAmount = rowData[this.headerIndices['总额']] || '0';
        const paymentDate = rowData[this.headerIndices['付款日期']] || '';

        // 1. 站点名称标准化
        let normalizedSite = site;
        if (site === 'Germany') {
            normalizedSite = 'DE';
        } else if (site === 'Australia') {
            normalizedSite = 'AU';
        }

        // 2. 无效货币过滤
        if (!this.currencies.includes(currency)) {
            return null; // 过滤掉无效货币的行
        }

        // 3. 金额提取
        let amount = 0;
        try {
            amount = parseFloat(totalAmount);
            if (isNaN(amount)) {
                amount = 0;
            }
        } catch (e) {
            amount = 0;
        }

        // 4. 汇率折算
        const exchangeRate = this.exchangeRates[currency] || 1;
        const usdAmount = amount * exchangeRate;

        // 5. 时区转换与格式化（处理付款日期）
        let formattedDate = '';
        try {
            // 解析原始时间 (格式: YYYYMMDD HH:mm:ss)
            if (paymentDate && paymentDate.length >= 17) {
                const year = parseInt(paymentDate.substring(0, 4));
                const month = parseInt(paymentDate.substring(4, 6));
                const day = parseInt(paymentDate.substring(6, 8));
                const hour = parseInt(paymentDate.substring(9, 11));
                const minute = parseInt(paymentDate.substring(12, 14));
                const second = parseInt(paymentDate.substring(15, 17));

                // 创建 Date 对象并设置为 UTC 时间（避免本地时区干扰）
                const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

                // 减去 15 小时转换为 UTC 时间
                const utcTime = date.getTime() - (15 * 60 * 60 * 1000);
                const utcDate = new Date(utcTime);

                // 使用 UTC 方法获取日期部分，避免本地时区影响
                const utcYear = utcDate.getUTCFullYear();
                const utcMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                const utcDay = String(utcDate.getUTCDate()).padStart(2, '0');

                // 格式化为 YYYY-MM-DD
                formattedDate = `${utcYear}-${utcMonth}-${utcDay}`;
            }
        } catch (e) {
            console.error('日期解析错误:', e, paymentDate);
            formattedDate = paymentDate.substring(0, 4) + '-' +
                           paymentDate.substring(4, 6) + '-' +
                           paymentDate.substring(6, 8);
        }

        return {
            date: formattedDate,
            ebayAccount: ebayAccount,
            site: normalizedSite,
            currency: currency,
            originalAmount: amount,
            usdAmount: usdAmount
        };
    }

    /**
     * 处理所有文件
     */
    async processAllFiles(onProgress) {
        const fileKeys = Array.from(this.files.keys());
        const totalFiles = fileKeys.length;
        const results = {
            totalRows: 0,
            filteredRows: 0,
            groupedData: new Map()
        };

        let processedFiles = 0;

        for (const fileKey of fileKeys) {
            const fileData = this.files.get(fileKey);

            // 跳过已处理的文件
            if (fileData.status === 'success' && fileData.data) {
                processedFiles++;
                continue;
            }

            // 解析 XML
            const parseResult = await this.parseXML(fileKey);

            if (parseResult.success && fileData.data) {
                // 处理每一行数据
                for (const rowData of fileData.data) {
                    results.totalRows++;
                    const transformed = this.transformRow(rowData);

                    if (transformed) {
                        // 生成联合主键
                        const groupKey = `${transformed.date}|${transformed.ebayAccount}|${transformed.site}|${transformed.currency}`;

                        // 累加数据
                        if (results.groupedData.has(groupKey)) {
                            const existing = results.groupedData.get(groupKey);
                            existing.originalAmount += transformed.originalAmount;
                            existing.usdAmount += transformed.usdAmount;
                        } else {
                            results.groupedData.set(groupKey, {
                                date: transformed.date,
                                ebayAccount: transformed.ebayAccount,
                                site: transformed.site,
                                currency: transformed.currency,
                                originalAmount: transformed.originalAmount,
                                usdAmount: transformed.usdAmount
                            });
                        }
                    } else {
                        results.filteredRows++;
                    }
                }
            }

            processedFiles++;
            if (onProgress) {
                onProgress({
                    processed: processedFiles,
                    total: totalFiles,
                    percent: Math.round((processedFiles / totalFiles) * 100)
                });
            }
        }

        // 转换为数组并按日期排序
        this.processedData = Array.from(results.groupedData.values()).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        return {
            success: true,
            fileCount: totalFiles,
            totalRows: results.totalRows,
            filteredRows: results.filteredRows,
            groupCount: this.processedData.length
        };
    }

    /**
     * 导出 Excel 报表
     */
    exportExcel() {
        if (this.processedData.length === 0) {
            throw new Error('没有可导出的数据');
        }

        // 创建工作簿
        const workbook = XLSX.utils.book_new();

        // 准备数据
        const header = ['付款日期(UTC)', 'eBay帐号', '站点', '货币', '原始货币总额', '总额(折算USD)'];
        const rows = this.processedData.map(item => [
            item.date,
            item.ebayAccount,
            item.site,
            item.currency,
            item.originalAmount,
            item.usdAmount
        ]);

        // 创建工作表
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

        // 计算合计行
        const totalUSDAmount = this.processedData.reduce((sum, item) => sum + item.usdAmount, 0);

        // 准备注释信息
        const date = new Date();
        const rateInfo = Object.entries(this.exchangeRates)
            .map(([currency, rate]) => `${currency}: ${rate}`)
            .join(', ');

        // 添加合计行和注释
        XLSX.utils.sheet_add_aoa(ws, [
            ['合计', '', '', '', '', totalUSDAmount],
            [],
            ['时区转换规则: 中国时间(UTC+8) 减去 15 小时转换为 UTC 时间'],
            [`汇率信息: ${rateInfo}`],
            [`报表生成时间: ${date.toLocaleString('zh-CN')}`]
        ], { origin: -1 });

        // 设置列宽
        ws['!cols'] = [
            { wch: 15 }, // 付款日期
            { wch: 20 }, // eBay帐号
            { wch: 10 }, // 站点
            { wch: 8 },  // 货币
            { wch: 18 }, // 原始货币总额
            { wch: 18 }  // 总额(折算USD)
        ];

        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(workbook, ws, '订单汇总');

        // 生成文件名：eBay汇总报表_年月日_时分.xlsx
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const filename = `eBay汇总报表_${year}${month}${day}_${hour}${minute}.xlsx`;

        // 在浏览器端直接生成并触发下载（数据不经过任何后端服务器）
        XLSX.writeFile(workbook, filename);

        return filename;
    }
}

// UI 控制器
class UIController {
    constructor() {
        this.processor = new OrderProcessor();
        this.initEventListeners();
    }

    initEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const exportBtn = document.getElementById('exportBtn');

        // 拖拽上传
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFileUpload(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            this.handleFileUpload(files);
            fileInput.value = ''; // 重置 input 以便可以重复上传相同文件
        });

        // 处理按钮
        processBtn.addEventListener('click', () => this.processFiles());
        exportBtn.addEventListener('click', () => this.exportExcel());
    }

    handleFileUpload(fileList) {
        const result = this.processor.addFiles(fileList);
        this.updateFileList();

        // 显示提示消息
        if (result.addedCount > 0 || result.duplicateCount > 0 || result.invalidCount > 0) {
            let message = '';
            if (result.addedCount > 0) {
                message += `成功添加 ${result.addedCount} 个文件。`;
            }
            if (result.duplicateCount > 0) {
                message += `跳过 ${result.duplicateCount} 个重复文件。`;
            }
            if (result.invalidCount > 0) {
                message += `忽略 ${result.invalidCount} 个非 XML 文件。`;
            }
            this.showMessage(message, 'success');
        }
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        this.processor.files.forEach((fileData, fileKey) => {
            const div = document.createElement('div');
            div.className = 'file-item';

            const [fileName] = fileKey.split('_');
            const fileSize = this.formatFileSize(fileData.file.size);
            const statusClass = fileData.status;
            const statusText = fileData.status === 'pending' ? '等待处理' :
                               fileData.status === 'success' ? '已处理' : '处理失败';

            div.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">📄</span>
                    <div>
                        <div class="file-name">${fileName}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
                <div class="file-status ${statusClass}">${statusText}</div>
            `;

            fileList.appendChild(div);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async processFiles() {
        if (this.processor.files.size === 0) {
            this.showMessage('请先上传文件', 'error');
            return;
        }

        // 更新汇率设置
        this.processor.exchangeRates = {
            'GBP': parseFloat(document.getElementById('gbpRate').value) || 1.33,
            'USD': parseFloat(document.getElementById('usdRate').value) || 1.00,
            'AUD': parseFloat(document.getElementById('audRate').value) || 0.70,
            'EUR': parseFloat(document.getElementById('eurRate').value) || 1.15
        };

        // 显示进度条
        const progressArea = document.getElementById('progressArea');
        const progressFill = document.getElementById('progressFill');
        const progressStatus = document.getElementById('progressStatus');
        const progressPercent = document.getElementById('progressPercent');

        progressArea.classList.remove('hidden');

        // 禁用处理按钮
        document.getElementById('processBtn').disabled = true;

        try {
            const result = await this.processor.processAllFiles((progress) => {
                progressFill.style.width = `${progress.percent}%`;
                progressStatus.textContent = `正在处理第 ${progress.processed}/${progress.total} 个文件...`;
                progressPercent.textContent = `${progress.percent}%`;
            });

            // 隐藏进度条
            progressArea.classList.add('hidden');

            // 显示结果
            document.getElementById('statFiles').textContent = result.fileCount;
            document.getElementById('statRows').textContent = result.totalRows;
            document.getElementById('statGroups').textContent = result.groupCount;
            document.getElementById('statFiltered').textContent = result.filteredRows;
            document.getElementById('resultSection').classList.remove('hidden');

            // 更新文件列表状态
            this.updateFileList();

            this.showMessage(`处理完成！共处理 ${result.fileCount} 个文件，生成 ${result.groupCount} 条汇总记录`, 'success');

        } catch (error) {
            progressArea.classList.add('hidden');
            this.showMessage(`处理失败: ${error.message}`, 'error');
        } finally {
            document.getElementById('processBtn').disabled = false;
        }
    }

    exportExcel() {
        try {
            const filename = this.processor.exportExcel();
            this.showMessage(`成功导出: ${filename}`, 'success');
        } catch (error) {
            this.showMessage(`导出失败: ${error.message}`, 'error');
        }
    }

    showMessage(message, type) {
        // 移除旧消息
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建新消息
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        // 添加到页面
        const content = document.querySelector('.content');
        content.appendChild(messageDiv);

        // 3秒后自动消失
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new UIController();
});
