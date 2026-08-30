import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  features?: string[];
}

export function PlaceholderPage({
  title,
  subtitle,
  icon: Icon,
  color = "text-primary",
  features = []
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-primary/10", color)}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Icon className={cn("w-16 h-16 mx-auto mb-4 opacity-50", color)} />
            <h3 className="text-lg font-medium mb-2">Módulo em Desenvolvimento</h3>
            <p className="text-muted-foreground mb-6">
              Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
            </p>
            
            {features.length > 0 && (
              <div className="max-w-md mx-auto">
                <p className="text-sm font-medium mb-3">Funcionalidades planejadas:</p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}