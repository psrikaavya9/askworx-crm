import { Mail, Phone, Building2, Briefcase, Globe, MapPin, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { C360Client } from "./types";

interface RowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

function InfoRow({ icon, label, value, mono = false }: RowProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p className={`mt-0.5 break-all text-sm text-gray-800 ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

interface Props {
  client: C360Client;
}

export function IdentityCard({ client }: Props) {
  const address = [
    client.address,
    client.city,
    client.state,
    client.postalCode,
    client.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="space-y-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        Identity
      </h3>

      <div className="space-y-3.5">
        <InfoRow
          icon={<Mail className="h-3.5 w-3.5" />}
          label="Email"
          value={client.email}
        />
        <InfoRow
          icon={<Phone className="h-3.5 w-3.5" />}
          label="Phone"
          value={client.phone}
        />
        <InfoRow
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Company"
          value={client.company}
        />
        <InfoRow
          icon={<Briefcase className="h-3.5 w-3.5" />}
          label="Job Title"
          value={client.jobTitle}
        />
        <InfoRow
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Website"
          value={client.website}
        />
        {address && (
          <InfoRow
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Address"
            value={address}
          />
        )}

        {/* GST — not yet in schema, shown as placeholder */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-gray-400">
            <Tag className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              GST Number
            </p>
            <p className="mt-0.5 text-sm text-gray-400 italic">Not provided</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      {client.tags.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {client.tags.map((tag) => (
              <Badge key={tag} variant="indigo">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {client.notes && (
        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Internal Notes
          </p>
          <p className="text-sm leading-relaxed text-gray-600">{client.notes}</p>
        </div>
      )}
    </Card>
  );
}
