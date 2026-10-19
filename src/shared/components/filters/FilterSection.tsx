import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';

export interface FilterSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Number of values selected in this group, shown beside the title. */
  activeCount?: number;
}

/** A collapsible group of related filter controls. */
export function FilterSection({
  title,
  children,
  defaultExpanded = true,
  activeCount = 0,
}: FilterSectionProps) {
  const id = useId();
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters elevation={0} square>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        id={`${id}-header`}
        aria-controls={`${id}-content`}
      >
        <Typography component="h3" variant="subtitle2">
          {title}
          {activeCount > 0 && ` (${activeCount})`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails id={`${id}-content`}>{children}</AccordionDetails>
    </Accordion>
  );
}
