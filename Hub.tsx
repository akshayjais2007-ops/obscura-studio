import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader, StatusPill, Empty } from '../components/ui';
import { CATEGORIES, FEATURES, featureRoute, type Category } from '../lib/features';
import { useT } from '../lib/i18n';
import { fadeUp, staggerKids } from '../lib/motion';

export default function Hub({ cat: forced }: { cat?: Category }) {
  const params = useParams();
  const id = (forced ?? params.cat) as Category;
  const t = useT();
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) return <Empty icon={<ArrowUpRight className="size-5" />} title="Not found" desc="That section doesn’t exist." />;
  const fs = FEATURES.filter((f) => f.cats.includes(id));
  return (
    <div>
      <PageHeader eyebrow={`${fs.length} tools`} title={t(cat.key)} desc={cat.blurb} />
      <motion.div variants={staggerKids(0.05)} initial="hidden" animate="show" className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {fs.map((f) => (
          <motion.div key={f.id} variants={fadeUp}>
            <Link to={featureRoute(f)} className="group block h-full rounded-[var(--radius-card)] hairline bg-panel/70 p-6 hover:bg-raise hover:border-line2 transition-colors relative overflow-hidden">
              <div className="absolute -right-10 -top-10 size-32 rounded-full bg-violet/0 group-hover:bg-violet/10 blur-2xl transition-colors duration-700" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[11px] text-dim">#{String(f.n).padStart(2, '0')}</span>
                <StatusPill status={f.status} />
              </div>
              <h3 className="font-display text-3xl mt-4 leading-tight">{f.name}</h3>
              <p className="text-sm text-mute mt-2 leading-relaxed">{f.desc}</p>
              <p className="text-xs text-dim mt-4 leading-relaxed">{f.note}</p>
              <span className="inline-flex items-center gap-1 text-sm mt-5 text-paper/80 group-hover:text-amber">Open <ArrowUpRight className="size-4" /></span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
