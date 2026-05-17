export const validateCurl = (curl) => {
    if (!curl || !curl.trim()) {
        return { isValid: false, message: "Command cannot be empty." };
    }
    if (!curl.trim().toLowerCase().startsWith("curl")) {
        return {
            isValid: false,
            message: "The command must start with 'curl'.",
        };
    }
    try {
        const json = curlToJson(curl);
        if (!curl.includes("{{TEXT}}")) {
            return {
                isValid: false,
                message: "Your cURL must contain {{TEXT}} variable to inject the user message."
            };
        }
        return { isValid: true, json };
    }
    catch (error) {
        return {
            isValid: false,
            message: "Invalid cURL command syntax. Please check for typos.",
        };
    }
};
function curlToJson(curl) {
    const result = { headers: {}, method: 'GET' };
    const parts = parseCurlCommand(curl);
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.startsWith('curl ') || trimmed === 'curl')
            continue;
        if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
            result.url = trimmed.slice(1, -1);
        }
        else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            result.url = trimmed.slice(1, -1);
        }
        else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
            result.url = trimmed.slice(1, -1);
        }
        else {
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                result.url = trimmed;
            }
        }
        if (trimmed.startsWith('-H ') || trimmed.startsWith('--header ')) {
            const headerValue = extractHeaderValue(trimmed);
            if (headerValue) {
                const colonIdx = headerValue.indexOf(':');
                if (colonIdx > 0) {
                    const key = headerValue.slice(0, colonIdx).trim();
                    const value = headerValue.slice(colonIdx + 1).trim();
                    result.headers[key.toLowerCase()] = value;
                }
            }
        }
        if (trimmed.startsWith('-X ') || trimmed.startsWith('--request ')) {
            result.method = extractMethodValue(trimmed);
        }
        if (trimmed.startsWith('-d ') || trimmed.startsWith('--data ') || trimmed.startsWith('--data-raw ')) {
            const dataValue = extractDataValue(trimmed);
            if (dataValue) {
                result.data = dataValue;
                if (result.method === 'GET')
                    result.method = 'POST';
            }
        }
    }
    return result;
}
function parseCurlCommand(curl) {
    const parts = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    for (let i = 0; i < curl.length; i++) {
        const char = curl[i];
        if ((char === '"' || char === "'") && !inQuote) {
            inQuote = true;
            quoteChar = char;
            current += char;
        }
        else if (char === quoteChar && inQuote) {
            inQuote = false;
            quoteChar = '';
            current += char;
        }
        else if (char === ' ' && !inQuote) {
            if (current.trim())
                parts.push(current);
            current = '';
        }
        else if (char === '\\' && i + 1 < curl.length) {
            current += curl[i + 1];
            i++;
        }
        else {
            current += char;
        }
    }
    if (current.trim())
        parts.push(current);
    return parts;
}
function extractHeaderValue(trimmed) {
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1)
        return '';
    return trimmed.slice(colonIdx + 1).trim();
}
function extractMethodValue(trimmed) {
    const spaceIdx = trimmed.indexOf(' ');
    return spaceIdx !== -1 ? trimmed.slice(spaceIdx + 1).trim().toUpperCase() : 'POST';
}
function extractDataValue(trimmed) {
    const spaceIdx = trimmed.indexOf(' ');
    return spaceIdx !== -1 ? trimmed.slice(spaceIdx + 1).trim() : '';
}
export function parseCurlVariables(curlCommand) {
    const result = curlToJson(curlCommand);
    const variables = {
        TEXT: '',
        IMAGE_BASE64: ''
    };
    let url = result.url || '';
    let body = result.data || {};
    const headers = { ...result.headers };
    url = url.replace(/\{\{TEXT\}\}/g, variables['TEXT'] || '');
    url = url.replace(/\{\{IMAGE_BASE64\}\}/g, variables['IMAGE_BASE64'] || '');
    if (typeof body === 'string') {
        body = body.replace(/\{\{TEXT\}\}/g, variables['TEXT'] || '');
        body = body.replace(/\{\{IMAGE_BASE64\}\}/g, variables['IMAGE_BASE64'] || '');
        try {
            body = JSON.parse(body);
        }
        catch {
            // Keep as string
        }
    }
    Object.keys(headers).forEach(key => {
        const h = headers[key];
        if (h) {
            headers[key] = h.replace(/\{\{TEXT\}\}/g, variables['TEXT'] || '');
        }
    });
    return {
        url,
        headers,
        body,
        method: result.method || 'POST'
    };
}
