import type { RowData } from "@tanstack/react-table";

// GenedsDataTable marks columns that only apply to geneds carrying a
// startsCounting date. ColumnMeta is an empty interface meant to be augmented.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    hidden?: boolean;
  }
}
