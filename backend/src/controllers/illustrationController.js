const crypto = require('crypto');
const illustrationService = require('../services/illustrationService');
const illustrationRepository = require('../repositories/illustrationRepository');
const userRepository = require('../repositories/userRepository');
const { getPolicyCatalog } = require('../models/policyCatalog');

/**
 * Serve sample policy data, policy types, riders, and premium options
 */
async function getCatalog(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: getPolicyCatalog(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Perform on-the-fly benefit calculation without requiring persistence
 */
async function calculate(req, res, next) {
  try {
    let { dob, gender, policyType, riders, sumAssured, modalPremium, premiumFrequency, pt, ppt, bonusStrategy } = req.body;

    // If DOB is not passed in request body but user is authenticated, use profile DOB
    if (!dob && req.user?.id) {
      const user = await userRepository.findUserById(req.user.id, { unmask: true });
      if (user && user.rawDob) {
        dob = user.rawDob;
      }
    }

    const illustrationResult = illustrationService.generateIllustration(
      {
        dob,
        gender: gender || 'M',
        policyType: policyType || 'ENDOWMENT',
        riders: Array.isArray(riders) ? riders : [],
        sumAssured,
        modalPremium,
        premiumFrequency: premiumFrequency || 'Yearly',
        pt,
        ppt,
      },
      {
        bonusStrategy,
      }
    );

    return res.status(200).json({
      success: true,
      data: illustrationResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Save a calculated illustration to database for logged in user
 */
async function save(req, res, next) {
  try {
    const userId = req.user.id;
    let { calculationData, policyName } = req.body;

    let toSave = calculationData;
    // If raw inputs were passed instead of precalculated object, calculate now
    if (!toSave || !toSave.schedule) {
      toSave = illustrationService.generateIllustration(req.body);
    }

    const saved = await illustrationRepository.saveIllustration(userId, {
      ...toSave,
      policyName: policyName || 'Traditional Endowment Policy',
    });

    return res.status(201).json({
      success: true,
      message: 'Illustration saved successfully.',
      data: saved,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get paginated calculation history
 */
async function getHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const history = await illustrationRepository.getUserIllustrations(userId, page, limit);

    return res.status(200).json({
      success: true,
      ...history,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single illustration by ID
 */
async function getById(req, res, next) {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);

    const illustration = await illustrationRepository.getIllustrationById(id, userId);
    if (!illustration) {
      return res.status(404).json({
        success: false,
        message: 'Illustration not found or access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      data: illustration,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Export illustration to CSV
 */
async function exportCSV(req, res, next) {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);

    const illustration = await illustrationRepository.getIllustrationById(id, userId);
    if (!illustration) {
      return res.status(404).json({
        success: false,
        message: 'Illustration not found.',
      });
    }

    const csvData = illustrationService.exportIllustrationToCSV(illustration);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="benefit-illustration-${id}.csv"`);
    return res.status(200).send(csvData);
  } catch (err) {
    next(err);
  }
}

/**
 * Bulk processing prototype: Upload CSV and process asynchronously
 */
async function bulkUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV file.',
      });
    }

    const userId = req.user.id;
    const fileName = req.file.originalname;
    const csvContent = req.file.buffer.toString('utf8');

    // Parse CSV lines
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is empty or contains only headers.',
      });
    }

    // Robust CSV line parser that respects quoted strings containing commas
    const parseCSVLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      values.push(current.trim());
      return values;
    };

    const cleanNum = (val) => {
      if (val === undefined || val === null || val === '') return NaN;
      const cleaned = String(val).replace(/["',\s]/g, '');
      return Number(cleaned);
    };

    const normalizeFrequency = (freq) => {
      if (!freq) return 'Yearly';
      const f = String(freq).trim().toLowerCase();
      if (f === 'yearly' || f === 'annual' || f === 'annually' || f === 'y') return 'Yearly';
      if (f === 'half-yearly' || f === 'half yearly' || f === 'semi-annual' || f === 'h') return 'Half-Yearly';
      if (f === 'monthly' || f === 'month' || f === 'm') return 'Monthly';
      return String(freq).trim();
    };

    const normalizeGender = (gender) => {
      if (!gender) return 'M';
      const g = String(gender).trim().toUpperCase();
      if (g === 'M' || g === 'MALE') return 'M';
      if (g === 'F' || g === 'FEMALE') return 'F';
      if (g === 'O' || g === 'OTHER') return 'Other';
      return String(gender).trim();
    };

    const headers = parseCSVLine(lines[0]).map((h) => h.replace(/["']/g, '').trim().toLowerCase());
    const dataRows = lines.slice(1);
    const totalRecords = dataRows.length;

    const jobId = crypto.randomUUID();
    const job = await illustrationRepository.createBulkJob(jobId, userId, fileName, totalRecords);

    // Asynchronous background batch processing
    setImmediate(async () => {
      let processed = 0;
      let successful = 0;
      let failed = 0;
      const failureReasons = {};
      const sampleErrors = [];

      await illustrationRepository.updateBulkJob(jobId, { status: 'PROCESSING' });

      const buildErrorSummary = () => {
        if (failed === 0) return null;
        const topReasons = Object.entries(failureReasons)
          .sort((a, b) => b[1] - a[1])
          .map(([reason, count]) => `• ${reason} (${count.toLocaleString()} row${count > 1 ? 's' : ''})`)
          .join('\n');

        const samples = sampleErrors.map((s) => `• ${s}`).join('\n');
        return `Failure Breakdown (${failed.toLocaleString()} failed rows):\n${topReasons}\n\nSample Failed Rows:\n${samples}`;
      };

      for (let i = 0; i < dataRows.length; i++) {
        const rowCols = parseCSVLine(dataRows[i]);
        const rowData = {};
        headers.forEach((h, idx) => {
          rowData[h] = rowCols[idx] !== undefined ? rowCols[idx] : '';
        });

        try {
          // Normalize row fields
          const policyParams = {
            dob: rowData.dob ? String(rowData.dob).replace(/["']/g, '').trim() : '',
            gender: normalizeGender(rowData.gender),
            sumAssured: cleanNum(rowData.sumassured || rowData['sum assured'] || rowData.sa),
            modalPremium: cleanNum(rowData.modalpremium || rowData['modal premium'] || rowData.premium),
            premiumFrequency: normalizeFrequency(rowData.frequency || rowData.premiumfrequency),
            pt: parseInt(cleanNum(rowData.pt || rowData['policy term']), 10),
            ppt: parseInt(cleanNum(rowData.ppt || rowData['premium paying term']), 10),
          };

          const calculated = illustrationService.generateIllustration(policyParams);

          await illustrationRepository.saveIllustration(userId, {
            ...calculated,
            policyName: `Bulk Policy Row ${i + 1}`,
          });

          successful++;
        } catch (rowErr) {
          failed++;
          const errorDetails = rowErr.validationErrors
            ? rowErr.validationErrors.join('; ')
            : (rowErr.message || 'Calculation error');

          const primaryError = rowErr.validationErrors && rowErr.validationErrors.length > 0
            ? rowErr.validationErrors[0]
            : (rowErr.message || 'Unknown error');

          failureReasons[primaryError] = (failureReasons[primaryError] || 0) + 1;

          if (sampleErrors.length < 5) {
            sampleErrors.push(`Row ${i + 2}: ${errorDetails}`);
          }

          if (failed <= 5) {
            console.warn(`[Bulk Upload Warning] Row ${i + 2} failed:`, errorDetails);
          }
        }
        processed++;

        // Batch update progress every 200 records or on completion (optimized for high volumes)
        if (processed % 200 === 0 || processed === totalRecords) {
          await illustrationRepository.updateBulkJob(jobId, {
            processed,
            successful,
            failed,
            errorMessage: buildErrorSummary(),
          });
        }
      }

      await illustrationRepository.updateBulkJob(jobId, {
        status: failed === totalRecords ? 'FAILED' : 'COMPLETED',
        processed,
        successful,
        failed,
        errorMessage: buildErrorSummary(),
      });
    });

    return res.status(202).json({
      success: true,
      message: 'Bulk processing job submitted successfully.',
      jobId,
      totalRecords,
      status: 'PROCESSING',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get status of bulk processing job
 */
async function getBulkJobStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;

    const job = await illustrationRepository.getBulkJob(jobId, userId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Bulk job not found.',
      });
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCatalog,
  calculate,
  save,
  getHistory,
  getById,
  exportCSV,
  bulkUpload,
  getBulkJobStatus,
};

