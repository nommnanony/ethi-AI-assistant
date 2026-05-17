import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';
export function Pagination({ currentPage, totalPages, onPageChange, className, showFirstLast = true, maxVisible = 5, }) {
    if (totalPages <= 1)
        return null;
    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        }
        else {
            const half = Math.floor(maxVisible / 2);
            let start = Math.max(1, currentPage - half);
            let end = Math.min(totalPages, start + maxVisible - 1);
            if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
            }
            if (start > 1) {
                pages.push(1);
                if (start > 2)
                    pages.push('ellipsis');
            }
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            if (end < totalPages) {
                if (end < totalPages - 1)
                    pages.push('ellipsis');
                pages.push(totalPages);
            }
        }
        return pages;
    };
    const pageNumbers = getPageNumbers();
    return (_jsxs("div", { className: cn('flex items-center gap-1', className), children: [showFirstLast && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => onPageChange(1), disabled: currentPage === 1, className: "w-8 h-8", children: _jsx(ChevronsLeft, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1, className: "w-8 h-8", children: _jsx(ChevronLeft, { className: "w-4 h-4" }) }), _jsx("div", { className: "flex items-center gap-1", children: pageNumbers.map((page, index) => page === 'ellipsis' ? (_jsx("span", { className: "px-2 text-text-muted", children: "..." }, `ellipsis-${index}`)) : (_jsx(Button, { variant: currentPage === page ? 'primary' : 'ghost', size: "icon", onClick: () => onPageChange(page), className: "w-8 h-8", children: page }, page))) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages, className: "w-8 h-8", children: _jsx(ChevronRight, { className: "w-4 h-4" }) }), showFirstLast && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => onPageChange(totalPages), disabled: currentPage === totalPages, className: "w-8 h-8", children: _jsx(ChevronsRight, { className: "w-4 h-4" }) }))] }));
}
export function PaginationInfo({ currentPage, pageSize, totalItems, className, }) {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    return (_jsxs("div", { className: cn('text-sm text-text-muted', className), children: ["Showing ", start, " to ", end, " of ", totalItems, " results"] }));
}
