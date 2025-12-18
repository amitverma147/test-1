// CommonJS version of csvMapping for server handlers
function sanitizeHeader(h) {
    return h
        .trim()
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "")
        .toLowerCase();
}

function cleanValue(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "" || s.toLowerCase() === "null") return null;
    return s;
}

function mapRowToRaw(row) {
    const out = {};
    for (const k of Object.keys(row)) {
        const key = sanitizeHeader(k);
        out[key] = cleanValue(row[k]);
    }
    return out;
}

function toSnakeCaseKeyMap(obj) {
    // maps known camelCase keys to snake_case DB columns for upsert
    const m = { ...obj };
    const mapping = {
        labourAmt: 'labour_amt',
        partAmt: 'part_amt',
        billAmount: 'bill_amount',
        groupName: 'group_name',
        callbackDate: 'callback_date',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        jobCardNumber: 'job_card_number',
        customerName: 'customer_name',
        customerMobile: 'customer_mobile',
        regNo: 'reg_no',
        vehicleModel: 'vehicle_model',
        vehicleRegNo: 'vehicle_reg_no',
    };

    const out = {};
    for (const k of Object.keys(m)) {
        const mapped = mapping[k] ?? k;
        out[mapped] = m[k];
    }
    return out;
}

module.exports = {
    sanitizeHeader,
    cleanValue,
    mapRowToRaw,
    toSnakeCaseKeyMap
};
