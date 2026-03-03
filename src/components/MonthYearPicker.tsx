import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const monthNames = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface MonthYearPickerProps {
  year: number;
  month: number; // 1-indexed
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

const MonthYearPicker = ({ year, month, onSelect, onClose }: MonthYearPickerProps) => {
  const [viewYear, setViewYear] = useState(year);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <div className="glass rounded-xl border border-border p-4 w-[280px] space-y-3 shadow-xl animate-fade-in">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setViewYear((y) => y - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">{viewYear}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setViewYear((y) => y + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-3 gap-2">
        {monthNames.map((name, i) => {
          const m = i + 1;
          const isSelected = viewYear === year && m === month;
          const isCurrent = viewYear === currentYear && m === currentMonth;

          return (
            <button
              key={m}
              onClick={() => {
                onSelect(viewYear, m);
                onClose();
              }}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-medium transition-all duration-150",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : isCurrent
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : "text-foreground hover:bg-muted"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 pt-1 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs text-muted-foreground"
          onClick={() => {
            onSelect(currentYear, currentMonth);
            onClose();
          }}
        >
          Mês atual
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs text-muted-foreground"
          onClick={onClose}
        >
          Fechar
        </Button>
      </div>
    </div>
  );
};

export default MonthYearPicker;
