'use client';

// Adapted from Kiranism ui/table/data-table.tsx and data-table-pagination.tsx (MIT).
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function DataTable<T>({ data, columns, search, onSearch, children }: {
  data: T[];
  columns: ColumnDef<T>[];
  search: string;
  onSearch: (value: string) => void;
  children?: React.ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({ data, columns, state: { sorting, globalFilter: search }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(), getSortedRowModel: getSortedRowModel(), initialState: { pagination: { pageSize: 10 } } });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="admin-table-toolbar">
        <input type="search" aria-label="搜索资源" placeholder="搜索名称、模型…" value={search} onChange={event => onSearch(event.target.value)} />
        {children}
      </div>
      <div className="admin-table-scroll rounded-lg border">
        <table className="admin-table">
          <thead className="bg-muted">
            {table.getHeaderGroups().map(group => (
              <tr key={group.id}>
                {group.headers.map(header => (
                  <th key={header.id} colSpan={header.colSpan} aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : undefined}>
                    {header.isPlaceholder
                      ? null
                      : header.column.getCanSort()
                        ? (
                            <button type="button" onClick={header.column.getToggleSortingHandler()}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {' '}
                              <span aria-hidden="true">{header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : '↕'}</span>
                            </button>
                          )
                        : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>{table.getRowModel().rows.length ? table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>) : <tr><td colSpan={columns.length} className="h-32 text-center text-muted-foreground">暂无符合条件的资源</td></tr>}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          共
          {table.getFilteredRowModel().rows.length}
          {' '}
          条
        </span>
        <div className="flex items-center gap-3">
          <label className="admin-page-size">
            每页
            <select aria-label="每页条数" value={table.getState().pagination.pageSize} onChange={event => table.setPageSize(Number(event.target.value))}>{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select>
          </label>
          <span>
            {table.getState().pagination.pageIndex + 1}
            {' '}
            /
            {' '}
            {Math.max(1, table.getPageCount())}
          </span>
          <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>上一页</Button>
          <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>下一页</Button>
        </div>
      </div>
    </div>
  );
}
