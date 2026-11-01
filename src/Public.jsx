import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Disc3, CalendarDays, MapPin, Trophy, Zap, Users, Image as ImageIcon, BookOpen, Clock, Instagram, Mail, ShieldCheck, LockKeyhole, Target, HeartHandshake, Play, ChevronRight, ChevronLeft, Star, UserRound, Medal, ArrowLeft, Camera, X, Maximize2 } from 'lucide-react';
import { sb, configured, query, date, time, fileUrl, fmtClock, errorText, getPostImages, getCleanPostBody } from './lib.js';
import { SectionHeader, Empty, Flash, useAuth } from './App.jsx';
import { useTheme } from './ThemeContext.jsx';
function useRows(table, opts = {}, realtime = false) { const [data, setData] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''); const optsKey = JSON.stringify(opts); useEffect(() => { let active = true; const load = () => { if (!sb) { setLoading(false); return; } query(table, opts).then(rows => active && setData(rows)).catch(e => active && setError(errorText(e))).finally(() => active && setLoading(false)) }; load(); let ch; if (realtime && sb) ch = sb.channel(`public-${table}-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table }, load).subscribe(); return () => { active = false; if (ch) sb.removeChannel(ch) } }, [table, optsKey, realtime]); return { data, loading, error }; }
const art = '/assets/';
function PageHero({ eyebrow, title, copy }) { return <section className="page-hero"><div className="wrap"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></section> }
function RoleTag({ role }) { return <span className="role-chip">{role}</span> }
function MatchCard({ m }) { const { logoSrc } = useTheme(); return <Link to={`/games/${m.id}`} className="match-card"><div className="match-top"><span className={'status ' + (m.status === 'live' ? 'live' : '')}>{m.status === 'live' ? <><i /> LIVE NOW</> : m.status.toUpperCase()}</span><span>{date(m.scheduled_at)}</span></div><div className="match-scores"><div><img src={logoSrc} alt="KID" /><b>KIDUCATCHIS</b></div><strong>{m.status === 'upcoming' ? 'VS' : `${m.score_us} : ${m.score_them}`}</strong><div className="opponent"><span>{m.opponent?.charAt(0)}</span><b>{m.opponent}</b></div></div><div className="match-bottom"><span><MapPin size={14} />{m.venue || 'Venue TBA'}</span><span>VIEW MATCH <ArrowUpRight size={15} /></span></div></Link> }
function LightboxModal({ images, initialIndex = 0, title, dateStr, onClose }) {
    const [index, setIndex] = useState(initialIndex);

    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && images.length > 1) setIndex(i => (i - 1 + images.length) % images.length);
            if (e.key === 'ArrowRight' && images.length > 1) setIndex(i => (i + 1) % images.length);
        }
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [images, onClose]);

    const cur = images[index] || images[0];
    if (!cur) return null;

    return (
        <div className="lightbox-shade" onClick={onClose} role="dialog" aria-modal="true">
            <div className="lightbox-box" onClick={e => e.stopPropagation()}>
                <div className="lightbox-bar">
                    <div>
                        <h3>{title || 'Club Media'}</h3>
                        {dateStr && <small>{dateStr}</small>}
                    </div>
                    <div className="lightbox-actions">
                        {images.length > 1 && (
                            <span className="lightbox-counter">
                                <Camera size={13} /> {index + 1} of {images.length}
                            </span>
                        )}
                        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close lightbox">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="lightbox-stage">
                    {images.length > 1 && (
                        <button
                            type="button"
                            className="lightbox-nav-btn prev"
                            onClick={() => setIndex((index - 1 + images.length) % images.length)}
                            aria-label="Previous photo"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <img
                        className="lightbox-img"
                        src={fileUrl('club-media', cur.path)}
                        alt={cur.caption || title || ''}
                    />
                    {images.length > 1 && (
                        <button
                            type="button"
                            className="lightbox-nav-btn next"
                            onClick={() => setIndex((index + 1) % images.length)}
                            aria-label="Next photo"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>

                {cur.caption ? (
                    <div className="lightbox-caption">
                        <Camera size={14} />
                        <p>{cur.caption}</p>
                    </div>
                ) : images.length > 1 ? (
                    <div className="lightbox-caption empty-cap">
                        <Camera size={14} />
                        <p>Photo {index + 1} of {images.length}</p>
                    </div>
                ) : null}

                {images.length > 1 && (
                    <div className="lightbox-thumbs">
                        {images.map((img, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`lightbox-thumb ${i === index ? 'active' : ''}`}
                                onClick={() => setIndex(i)}
                            >
                                <img src={fileUrl('club-media', img.path)} alt="" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function StoryMediaViewer({ post }) {
    const images = getPostImages(post);
    const [index, setIndex] = useState(0);
    const [lightbox, setLightbox] = useState(false);

    if (!images.length) {
        return <div className="story-placeholder"><Disc3 size={55} /></div>;
    }

    const cur = images[index] || images[0];

    return (
        <div className="story-media-box">
            <div className="story-media-viewport" onClick={() => setLightbox(true)} title="Click to view full image">
                <img
                    className="story-full-img"
                    loading="lazy"
                    src={fileUrl('club-media', cur.path)}
                    alt={cur.caption || post.title}
                />
                <span className="story-category-tag">{post.type === 'photo' ? 'CLUB MOMENTS' : 'STORIES'}</span>
                {images.length > 1 && (
                    <span className="story-media-counter">
                        <Camera size={12} /> {index + 1} / {images.length}
                    </span>
                )}
                {images.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="story-slider-arrow left"
                            aria-label="Previous photo"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIndex((index - 1 + images.length) % images.length);
                            }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            type="button"
                            className="story-slider-arrow right"
                            aria-label="Next photo"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIndex((index + 1) % images.length);
                            }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </>
                )}
            </div>

            {cur.caption ? (
                <div className="story-caption-bar" onClick={() => setLightbox(true)}>
                    <Camera size={13} className="caption-ico" />
                    <span>{cur.caption}</span>
                </div>
            ) : images.length > 1 ? (
                <div className="story-caption-bar muted-caption" onClick={() => setLightbox(true)}>
                    <Camera size={13} className="caption-ico" />
                    <span>Photo {index + 1} of {images.length}</span>
                </div>
            ) : null}

            {images.length > 1 && (
                <div className="story-thumb-strip">
                    {images.map((img, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`story-strip-dot ${i === index ? 'active' : ''}`}
                            onClick={() => setIndex(i)}
                            title={img.caption || `Photo ${i + 1}`}
                        >
                            <img src={fileUrl('club-media', img.path)} alt="" />
                        </button>
                    ))}
                </div>
            )}

            {lightbox && (
                <LightboxModal
                    images={images}
                    initialIndex={index}
                    title={post.title}
                    dateStr={date(post.created_at)}
                    onClose={() => setLightbox(false)}
                />
            )}
        </div>
    );
}

function StoryCard({ p }) {
    const images = getPostImages(p);
    const cover = images[0]?.path || p.image_path;
    const cleanBody = getCleanPostBody(p.body);

    return (
        <article className="story-card">
            <Link to="/stories" className="story-img">
                {cover ? (
                    <img loading="lazy" src={fileUrl('club-media', cover)} alt={p.title} />
                ) : (
                    <div className="story-placeholder"><Disc3 size={65} /></div>
                )}
                <span>{p.type === 'photo' ? 'CLUB MOMENTS' : 'STORIES'}</span>
                {images.length > 1 && (
                    <span className="story-card-photos-badge">
                        <Camera size={11} /> {images.length} PHOTOS
                    </span>
                )}
            </Link>
            <div className="story-text">
                <small>{date(p.created_at)} {p.pinned ? '· PINNED' : ''}</small>
                <h3>{p.title}</h3>
                {images[0]?.caption && (
                    <div className="story-card-cover-caption">
                        <Camera size={12} />
                        <span>"{images[0].caption}"</span>
                    </div>
                )}
                <p>{cleanBody?.slice(0, 130)}{cleanBody?.length > 130 ? '…' : ''}</p>
                <Link to="/stories">Read more <ArrowUpRight size={16} /></Link>
            </div>
        </article>
    );
}
const TICKER_MOTTO = ['THROW WITH PURPOSE', 'PLAY WITH HEART', 'CATCH THE SPIRIT'];
function TickerStrip() {
    const items = [...TICKER_MOTTO, ...TICKER_MOTTO, ...TICKER_MOTTO, ...TICKER_MOTTO];
    return (
        <div className="ticker" aria-label="Club motto">
            <div className="ticker-track">
                <div className="ticker-group">
                    {items.map((text, i) => (
                        <span key={`t1-${i}`} className="ticker-item">
                            {text} <Disc3 />
                        </span>
                    ))}
                </div>
                <div className="ticker-group" aria-hidden="true">
                    {items.map((text, i) => (
                        <span key={`t2-${i}`} className="ticker-item">
                            {text} <Disc3 />
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
export function Home() {
    const { logoSrc, jerseySrc, altJerseySrc } = useTheme();
    const { data: matches } = useRows('matches', { order: 'scheduled_at', limit: 60 }, true), { data: posts } = useRows('posts', { order: 'created_at', limit: 24 }), { data: profiles } = useRows('profiles', { order: 'created_at', limit: 500 }, true), { data: tourneys } = useRows('tournaments', { order: 'starts_on', asc: true, limit: 30 }); const featured = [...matches].sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || Number(b.pinned) - Number(a.pinned) || new Date(b.scheduled_at) - new Date(a.scheduled_at)).slice(0, 3); const featuredPosts = [...posts].filter(p => p.published).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at) - new Date(a.created_at)).slice(0, 3); const next = tourneys.find(t => t.status !== 'completed' && t.starts_on >= new Date(Date.now() - 864e5).toISOString().slice(0, 10)); const selectedSquad = profiles.filter(p => p.is_active && p.in_squad === true); return <>
        <section className="hero"><div className="hero-dots" /><div className="wrap hero-layout"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-line" /> ULTIMATE FRISBEE • ONE FAMILY</div><h1>WE DON'T<br />JUST <em>PLAY.</em><br /><span>WE FLY.</span></h1><p>Built on hustle, fueled by spirit. Meet Kiducatchis — the team that brings its whole heart to every throw, cut, and catch.</p><div className="hero-actions"><Link to="/squad" className="btn btn-primary">MEET THE SQUAD <ArrowUpRight size={18} /></Link><Link className="text-link" to="/tournaments">Explore game day <ArrowRight size={17} /></Link></div><div className="hero-scroll"><ArrowDown size={17} /> SCROLL TO EXPLORE <span>01 / 04</span></div></div><div className="hero-visual"><div className="hero-halo" /><div className="jersey-feature"><img src={jerseySrc} alt="Kiducatchis ultimate frisbee jersey front and back" /></div><div className="flying-badge"><Disc3 size={25} /> FLY HIGH. <b>CATCH HARD.</b></div><img className="hero-mascot" src="/assets/mascot.webp" alt="Kiducatchis mascot" /><span className="vertical-note">THE KIDUCATCHIS ERA</span></div></div><div className="hero-bottom-bar"><div className="wrap"><span>PASSION <i /> PRECISION <i /> SPIRIT</span><span>EST. IN THE LOVE OF THE GAME <Disc3 size={17} /></span></div></div></section>
        <TickerStrip />
        <section className="section game-section"><div className="wrap"><SectionHeader eyebrow="// FROM THE SIDELINES" title={<>GAME DAY <em>ENERGY.</em></>} copy="Follow the action as it happens. Every point, every block, every big moment." action={<Link className="section-link" to="/tournaments">ALL MATCHES <ArrowUpRight size={17} /></Link>} />{featured.length ? <div className="match-grid">{featured.map(m => <MatchCard key={m.id} m={m} />)}</div> : <div className="home-game-placeholder"><Disc3 size={46} /><div><h3>THE NEXT GAME IS COMING.</h3><p>When the council adds a tournament or starts a live game, scores appear here automatically.</p></div><Link to="/tournaments" className="btn btn-outline">Game schedule <ArrowRight size={16} /></Link></div>}</div></section>
        <section className="club-story-strip"><div className="wrap story-strip-layout"><div className="story-strip-media"><img loading="lazy" src={altJerseySrc} alt="Kiducatchis alternate jersey" /><span className="corner-number">02 / WHO WE ARE</span></div><div className="story-strip-copy"><span className="eyebrow">// BEYOND THE GAME</span><h2>MORE THAN<br />A TEAM.<br /><em>A TRIBE.</em></h2><p>We believe great teams aren't made only on the scoreboard. They're made in early-morning practices, sideline cheers, trusted throws, and friendships that stick long after the final point.</p><div className="values-row"><span><Target size={22} /> HUSTLE</span><span><HeartHandshake size={22} /> SPIRIT</span><span><Zap size={22} /> UNITY</span></div><Link to="/about" className="btn btn-outline">OUR STORY <ArrowUpRight size={18} /></Link></div></div></section>
        <section className="section"><div className="wrap"><SectionHeader eyebrow="// FACES OF THE FRANCHISE" title={<>THE <em>LINEUP.</em></>} copy="Different strengths. One unstoppable crew." action={<Link className="section-link" to="/squad">FULL ROSTER <ArrowUpRight size={17} /></Link>} />{selectedSquad.length ? <div className="member-grid">{selectedSquad.slice(0, 4).map(p => <MemberCard key={p.id} p={p} />)}</div> : <div className="squad-promo"><img src="/assets/mascot.webp" alt="Kiducatchis mascot" /><div><h3>THE SQUAD IS ASSEMBLING.</h3><p>The council will announce the selected squad here. Player accounts can be created before selection.</p></div><Link className="btn btn-primary" to="/squad">See the squad <ArrowUpRight size={16} /></Link></div>}</div></section>
        <section className="section next-game-band"><div className="wrap next-game-inner"><span className="eyebrow">// UP NEXT ON THE CALENDAR</span><h2>{next ? next.name : 'YOUR NEXT GREAT PLAY STARTS HERE.'}</h2><p>{next ? `${date(next.starts_on)} • ${next.location || 'Location TBA'}` : 'Tournament announcements and selected squad lists will show here.'}</p><Link to="/tournaments" className="btn btn-primary">VIEW TOURNAMENTS <ArrowUpRight size={17} /></Link></div><img src="/assets/mascot.webp" alt="" /></section>
        <section className="section"><div className="wrap"><SectionHeader eyebrow="// LIFE BETWEEN THE LINES" title={<>LATEST <em>STORIES.</em></>} copy="Behind the points, there's always a story worth telling." action={<Link className="section-link" to="/stories">ALL STORIES <ArrowUpRight size={17} /></Link>} />{featuredPosts.length ? <div className="story-grid">{featuredPosts.map(p => <StoryCard key={p.id} p={p} />)}</div> : <Empty icon={BookOpen} title="Stories are on their way" text="Club members can share articles and photos from their dashboard." />}</div></section>
        <section className="home-cta"><div className="wrap"><img src={logoSrc} alt="Kiducatchis" /><h2>ONE DISC.<br /><em>ENDLESS POSSIBILITIES.</em></h2><p>The next chapter is waiting to be written. Be part of it.</p><Link className="btn btn-primary" to="/contact">GET IN TOUCH <ArrowUpRight size={18} /></Link></div></section></>
}
export function MemberCard({ p }) { return <Link to={`/profile/${p.id}`} className="member-card"><div className="member-picture">{p.avatar_path ? <img src={fileUrl('club-media', p.avatar_path)} alt={p.full_name} /> : <div className="avatar-placeholder">{p.full_name?.charAt(0)}</div>}<span className="jersey-big">{p.jersey_number === null ? '—' : p.jersey_number}</span></div><div className="member-meta"><div><h3>{p.full_name}</h3><small>{p.position}</small></div><ArrowUpRight size={19} /></div>{p.role !== 'player' && <span className="member-ribbon">{p.council_title || p.role}</span>}</Link> }
export function Squad() {
    const { data, loading, error } = useRows('profiles', { order: 'full_name' }, true);
    const [pos, setPos] = useState('All');
    const [q, setQ] = useState('');

    // Only Admin/Council-selected players appear in the public squad.
    const selectedPlayers = data.filter(p =>
        p.is_active && p.in_squad === true
    );
    const found = selectedPlayers.filter(p =>
        (pos === 'All' || p.position === pos) &&
        p.full_name?.toLowerCase().includes(q.trim().toLowerCase())
    );

    return <>
        <PageHero
            eyebrow="// THE PEOPLE BEHIND THE POINTS"
            title={<>MEET THE <em>SQUAD.</em></>}
            copy="The players selected to represent Kiducatchis. One team, one spirit."
        />
        <section className="section">
            <div className="wrap">
                <div className="filter-bar">
                    <div className="chips">
                        {['All', 'Handler', 'Cutter', 'Flexible'].map(x =>
                            <button key={x} className={pos === x ? 'chip active' : 'chip'} onClick={() => setPos(x)}>{x}</button>
                        )}
                    </div>
                    <input
                        aria-label="Search squad"
                        placeholder="Search squad..."
                        value={q}
                        onChange={e => setQ(e.target.value)}
                    />
                </div>
                {error ? (
                    <Empty icon={Users} title="Unable to load squad" text={error} />
                ) : found.length ? (
                    <div className="member-grid">
                        {found.map(p => <MemberCard key={p.id} p={p} />)}
                    </div>
                ) : (
                    <Empty
                        icon={Users}
                        title={loading ? 'Loading squad...' : selectedPlayers.length ? 'No matching players' : 'Squad not selected yet'}
                        text={loading
                            ? 'Retrieving the latest club lineup.'
                            : selectedPlayers.length
                                ? 'Try a different name or position.'
                                : 'Admin and Council will select the club squad from the existing player list.'}
                    />
                )}
            </div>
        </section>
    </>;
}

export function Council() { const { data } = useRows('profiles', { order: 'full_name' }); return <><PageHero eyebrow="// MEET THE LEADERSHIP" title={<>THE <em>COUNCIL.</em></>} copy="The people carrying the vision, guiding the spirit, and keeping the club moving." /><section className="section"><div className="wrap">{data.some(p => p.is_active && ['council', 'admin'].includes(p.role)) ? <div className="member-grid">{data.filter(p => p.is_active && ['council', 'admin'].includes(p.role)).map(p => <MemberCard p={p} key={p.id} />)}</div> : <Empty title="Council list coming soon" text="Council profiles appear here when the administrator assigns their roles." />}</div></section></> }
export function About() { const { jerseySrc } = useTheme(); return <><PageHero eyebrow="// THIS IS OUR STORY" title={<>BUILT TO <em>FLY.</em></>} copy="Our game is ultimate. Our bond is everything." /><section className="section"><div className="wrap about-grid"><div><span className="eyebrow">// WHO WE ARE</span><h2>THE DISC CONNECTS US.</h2><p>Kiducatchis is an ultimate frisbee club that celebrates the speed, strategy and spirit of the sport. We value trust, creativity, teamwork and respect on and off the pitch.</p><p>From our first warm-up to the last point of the final, we push each other to grow — as athletes and as people. Every teammate has a place here.</p><div className="values-row"><span><Zap /> ENERGY</span><span><HeartHandshake /> SPIRIT</span><span><Target /> PRECISION</span></div></div><img src={jerseySrc} alt="Kiducatchis club jersey" /></div></section><section className="section alt-section"><div className="wrap"><SectionHeader eyebrow="// OUR CODE" title={<>PLAY HARD. <em>PLAY FAIR.</em></>} /><div className="value-cards"><article><span>01</span><h3>THE SPIRIT</h3><p>Respect the opponent, honor the rules, and keep the game beautiful.</p></article><article><span>02</span><h3>THE TEAM</h3><p>Trust the throw, make the cut, and always back your people.</p></article><article><span>03</span><h3>THE DRIVE</h3><p>Show up, improve, and take the next step together.</p></article></div></div></section></> }
export function Gallery() {
    const { data } = useRows('posts', { eq: { type: 'photo' }, order: 'created_at', limit: 120 });
    const [viewer, setViewer] = useState(null);

    const items = useMemo(() => {
        const list = [];
        data.filter(p => p.published).forEach(p => {
            const imgs = getPostImages(p);
            imgs.forEach((img, idx) => {
                list.push({
                    id: `${p.id}-${idx}`,
                    post: p,
                    img,
                    index: idx,
                    allImages: imgs
                });
            });
        });
        return list;
    }, [data]);

    return <>
        <PageHero eyebrow="// FREEZE THE MOMENT" title={<>THROUGH OUR <em>LENS.</em></>} copy="Every epic layout, every road trip, every off-field memory." />
        <section className="section">
            <div className="wrap">
                {items.length ? (
                    <div className="gallery-grid">
                        {items.map(item => (
                            <figure
                                key={item.id}
                                className="gallery-card-item"
                                onClick={() => setViewer({
                                    images: item.allImages,
                                    index: item.index,
                                    title: item.post.title,
                                    dateStr: date(item.post.created_at)
                                })}
                            >
                                <img
                                    src={fileUrl('club-media', item.img.path)}
                                    alt={item.img.caption || item.post.title}
                                    loading="lazy"
                                />
                                {item.allImages.length > 1 && (
                                    <span className="gallery-item-badge">
                                        <Camera size={11} /> {item.index + 1} of {item.allImages.length}
                                    </span>
                                )}
                                <figcaption>
                                    <h3>{item.img.caption || item.post.title}</h3>
                                    <span>
                                        {date(item.post.created_at)}
                                        {item.img.caption && item.img.caption !== item.post.title ? ` · ${item.post.title}` : ''}
                                    </span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                ) : (
                    <Empty icon={ImageIcon} title="Gallery is coming to life" text="Member-uploaded pictures will be displayed right here." />
                )}
            </div>
        </section>

        {viewer && (
            <LightboxModal
                images={viewer.images}
                initialIndex={viewer.index}
                title={viewer.title}
                dateStr={viewer.dateStr}
                onClose={() => setViewer(null)}
            />
        )}
    </>;
}

export function Stories() {
    const { data } = useRows('posts', { order: 'created_at', limit: 150 });
    const [expanded, setExpanded] = useState(null);
    const entries = data.filter(p => p.published).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at) - new Date(a.created_at));

    return <>
        <PageHero eyebrow="// EVERY POINT HAS A STORY" title={<>FROM THE <em>SIDELINES.</em></>} copy="News, match-day memories, behind-the-scenes stories and everything Kiducatchis." />
        <section className="section">
            <div className="wrap">
                {entries.length ? (
                    <div className="story-grid">
                        {entries.map(p => {
                            const cleanBody = getCleanPostBody(p.body);
                            return (
                                <article className="story-card" key={p.id}>
                                    <StoryMediaViewer post={p} />
                                    <div className="story-text">
                                        <small>{date(p.created_at)} · {p.type === 'photo' ? 'PHOTO ALBUM' : 'BLOG'} {p.pinned ? '· ★ PINNED' : ''}</small>
                                        <h3>{p.title}</h3>
                                        <p className={expanded === p.id ? 'long-copy' : ''}>{cleanBody}</p>
                                        {cleanBody?.length > 140 && (
                                            <button className="inline-button" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                                                {expanded === p.id ? 'Read less' : 'Read full story'} <ArrowRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <Empty icon={BookOpen} title="Your first story is waiting" text="Signed-in players can post the first club story from the dashboard." />
                )}
            </div>
        </section>
    </>;
}
export function Tournaments() { const { data: tournaments } = useRows('tournaments', { order: 'starts_on', asc: false }), { data: matches } = useRows('matches', { order: 'scheduled_at', limit: 200 }, true), { data: roster } = useRows('tournament_roster', { limit: 500 }); return <><PageHero eyebrow="// WHEN IT'S GAME TIME" title={<>CHASE THE <em>POINT.</em></>} copy="Upcoming tournaments, live games, rosters, and a play-by-play archive." /><section className="section"><div className="wrap"><SectionHeader eyebrow="// MATCH CENTRE" title={<>SCOREBOARD <em>& RESULTS.</em></>} />{matches.length ? <div className="match-grid">{[...matches].sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || new Date(b.scheduled_at) - new Date(a.scheduled_at)).map(m => <MatchCard key={m.id} m={m} />)}</div> : <Empty icon={Trophy} title="No games scheduled yet" text="Council members can add tournaments and matches from their dashboard." />}<div className="subsection-spacer" /><SectionHeader eyebrow="// ALL TOURNAMENTS" title={<>THE <em>CALENDAR.</em></>} />{tournaments.length ? <div className="tournament-list">{tournaments.map(t => <article key={t.id} className="tournament-item"><div className="tournament-date"><CalendarDays /><b>{date(t.starts_on)}</b></div><div><h3>{t.name}</h3><p>{t.description || 'A new chapter in the Kiducatchis journey.'}</p><small><MapPin size={14} />{t.location || 'TBA'} · {roster.filter(r => r.tournament_id === t.id).length} squad members</small></div><div className="tournament-end"><span className="status">{t.status}</span><span>{matches.filter(m => m.tournament_id === t.id).length} matches</span></div></article>)}</div> : <Empty title="No tournaments yet" text="Your tournament schedule will appear once the council creates one." />}</div></section></> }
export function MatchPage() { const { id } = useParams(), [match, setMatch] = useState(null), [events, setEvents] = useState([]), [roster, setRoster] = useState([]), [names, setNames] = useState({}), [clock, setClock] = useState(Date.now()); useEffect(() => { if (!sb) return; let active = true; const load = async () => { const [{ data: m }, { data: e }, { data: p }] = await Promise.all([sb.from('matches').select('*').eq('id', id).maybeSingle(), sb.from('match_events').select('*').eq('match_id', id).order('game_second', { ascending: false }), sb.from('profiles').select('id,full_name')]); if (!active) return; setMatch(m); setEvents(e || []); setNames(Object.fromEntries((p || []).map(x => [x.id, x.full_name]))); if (m) { const { data: r } = await sb.from('tournament_roster').select('*').eq('tournament_id', m.tournament_id); if (active) setRoster(r || []); } }; load(); const ch = sb.channel('match-view-' + id).on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${id}` }, load).subscribe(); const tick = setInterval(() => setClock(Date.now()), 1000); return () => { active = false; sb.removeChannel(ch); clearInterval(tick) } }, [id]); if (!match) return <div className="wrap padded"><Empty title="Game not found" text="Check back after your council schedules the match." /></div>; const elapsed = match.elapsed_before_pause + (match.clock_running && match.clock_started_at ? Math.max(0, Math.floor((clock - new Date(match.clock_started_at).getTime()) / 1000)) : 0); const label = k => ({ point_us: 'POINT — KIDUCATCHIS', point_them: 'POINT — OPPONENT', block: 'DEFENSIVE BLOCK', turnover: 'TURNOVER', on: 'PLAYER ON', off: 'PLAYER OFF', other: 'GAME NOTE' }[k] || k); return <><PageHero eyebrow="// THE MATCH CENTER" title={<>KIDUCATCHIS <em>VS {match.opponent.toUpperCase()}</em></>} copy={`${date(match.scheduled_at)} · ${match.venue || 'Venue TBA'}`} /><section className="section"><div className="wrap match-detail"><div className="big-score"><span className={'status ' + (match.status === 'live' ? 'live' : '')}>{match.status === 'live' ? '● LIVE NOW' : match.status.toUpperCase()}</span><div className="big-score-numbers"><span>KIDUCATCHIS</span><strong>{match.status === 'upcoming' ? '—' : match.score_us} <em>:</em> {match.status === 'upcoming' ? '—' : match.score_them}</strong><span>{match.opponent.toUpperCase()}</span></div><p><Clock size={16} /> GAME CLOCK {fmtClock(elapsed)}</p></div><div className="match-details-grid"><div><h2>PLAY BY PLAY</h2>{events.length ? <div className="events-list">{events.map(e => <div className="event-row" key={e.id}><time>{fmtClock(e.game_second)}</time><div><b>{label(e.kind)}</b><p>{names[e.player_id] || ''}{e.assist_id ? ` · ASSIST: ${names[e.assist_id] || 'Unknown'}` : ''}{e.detail ? ` — ${e.detail}` : ''}</p></div></div>)}</div> : <Empty title="No events recorded yet" text="Game actions will appear as the scorer records them." />}</div><div><h2>MATCH SQUAD</h2>{roster.length ? <div className="roster-mini">{roster.map(r => <div key={r.id}><b>#{r.jersey_number ?? '—'}</b><span>{names[r.player_id] || 'Player'}</span><small>{r.team_role}</small></div>)}</div> : <Empty title="Roster not set" />}</div></div></div></section></> }
export function ProfilePage() { const { id } = useParams(), [person, setPerson] = useState(null), [roster, setRoster] = useState([]), [tours, setTours] = useState({}), [events, setEvents] = useState([]), [matches, setMatches] = useState({}); useEffect(() => { if (!sb) return; let on = true; (async () => { const [{ data: p }, { data: r }, { data: e }] = await Promise.all([sb.from('profiles').select('*').eq('id', id).maybeSingle(), sb.from('tournament_roster').select('*').eq('player_id', id), sb.from('match_events').select('kind,match_id,player_id,assist_id').or(`player_id.eq.${id},assist_id.eq.${id}`)]); if (!on) return; setPerson(p); setRoster(r || []); setEvents(e || []); const ids = [...new Set((r || []).map(x => x.tournament_id))]; if (ids.length) { const [{ data: t }, { data: m }] = await Promise.all([sb.from('tournaments').select('*').in('id', ids), sb.from('matches').select('*').in('tournament_id', ids)]); if (on) { setTours(Object.fromEntries((t || []).map(x => [x.id, x]))); setMatches(Object.fromEntries((m || []).map(x => [x.id, x]))) } } })(); return () => { on = false } }, [id]); if (!person) return <div className="wrap padded"><Empty title="Profile not found" /></div>; const goals = events.filter(x => x.kind === 'point_us' && x.player_id === id).length, assists = events.filter(x => x.kind === 'point_us' && x.assist_id === id).length, blocks = events.filter(x => x.kind === 'block' && x.player_id === id).length; return <><PageHero eyebrow="// PLAYER PROFILE" title={<>{person.full_name.toUpperCase()}</>} copy={`${person.position} · #${person.jersey_number ?? '—'} · ${person.council_title || person.role}`} /><section className="section"><div className="wrap profile-layout"><div className="profile-card">{person.avatar_path ? <img src={fileUrl('club-media', person.avatar_path)} alt={person.full_name} /> : <UserRound size={100} />}<h2>{person.full_name}</h2><span className="role-chip">{person.council_title || person.role}</span><p>{person.bio || 'Kiducatchis crew member.'}</p></div><div><div className="profile-stats"><div><strong>{roster.length}</strong><span>TOURNAMENTS</span></div><div><strong>{goals}</strong><span>POINTS</span></div><div><strong>{assists}</strong><span>ASSISTS</span></div><div><strong>{blocks}</strong><span>BLOCKS</span></div></div><h2>TOURNAMENT HISTORY</h2>{roster.length ? <div className="history-list">{roster.map(r => <article key={r.id}><div><b>{tours[r.tournament_id]?.name || 'Tournament'}</b><p>{r.position} · {r.team_role} · #{r.jersey_number ?? '—'}</p></div><span>{date(tours[r.tournament_id]?.starts_on)}</span></article>)}</div> : <Empty title="No tournament history yet" text="The player's participation will be tracked here." />}<h2>SCORING HIGHLIGHTS</h2>{events.filter(e => ['point_us', 'block'].includes(e.kind) || e.assist_id === id).length ? <div className="history-list">{events.filter(e => ['point_us', 'block'].includes(e.kind) || e.assist_id === id).slice(0, 8).map((e, i) => <article key={i}><div><b>{e.assist_id === id ? 'ASSIST' : e.kind === 'block' ? 'BLOCK' : 'POINT'}</b><p>{matches[e.match_id]?.opponent ? `vs ${matches[e.match_id].opponent}` : 'Match highlight'}</p></div>{matches[e.match_id] && <Link to={`/games/${e.match_id}`}>View <ArrowUpRight size={14} /></Link>}</article>)}</div> : <Empty title="No stats yet" text="Game-day records populate this section automatically." />}</div></div></section></> }
export function Contact() { const [form, setForm] = useState({ name: '', email: '', message: '' }), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''); async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { if (!sb) throw Error('Connect Supabase first.'); const { error: err } = await sb.from('contact_messages').insert(form); if (err) throw err; setForm({ name: '', email: '', message: '' }); setSuccess('Your message was sent to the club council.') } catch (e) { setError(errorText(e)) } finally { setBusy(false) } } return <><PageHero eyebrow="// MAKE THE CONNECTION" title={<>SAY <em>HELLO.</em></>} copy="Questions, collaborations, tryout enquiries, or just want to say hi?" /><section className="section"><div className="wrap contact-grid"><div className="contact-aside"><span className="eyebrow">// TALK TO THE TRIBE</span><h2>LET'S MAKE SOMETHING HAPPEN.</h2><p>Want to play with us? Follow our upcoming matches or share an idea? Drop us a note and our council will get back to you.</p><img src="/assets/mascot.webp" alt="Kiducatchis mascot" /></div><form className="panel form-stack" onSubmit={submit}><h2>DROP US A MESSAGE</h2><label>Your name<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Email<input type="email" required maxLength={255} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Your message<textarea minLength={4} required rows={6} maxLength={5000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label><Flash error={error} success={success} /><button className="btn btn-primary" disabled={busy}>{busy ? 'SENDING...' : 'SEND MESSAGE'} <ArrowUpRight size={16} /></button></form></div></section></> }
export function Login() {
    const { user } = useAuth(), { logoSrc } = useTheme(), nav = useNavigate(), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    if (user) return <Navigate to="/dashboard" replace />;
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            if (!sb) throw Error('Configure Supabase first.');
            const { error: err } = await sb.auth.signInWithPassword({ email, password });
            if (err) throw err;
            nav('/dashboard');
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="auth-screen">
            <div className="auth-panel">
                <img src={logoSrc} alt="Kiducatchis" />
                <span className="eyebrow">// EXCLUSIVE MEMBER AREA</span>
                <h1>WELCOME <em>BACK.</em></h1>
                <p>Sign in with your council-issued account.</p>
                <form onSubmit={submit} className="form-stack">
                    <label>Email address<input required type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} /></label>
                    <label>Password<input required minLength={6} type="password" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} /></label>
                    <Flash error={error} />
                    <button className="btn btn-primary" disabled={busy}>{busy ? 'SIGNING IN...' : 'ACCESS THE CLUB'} <ArrowRight size={17} /></button>
                </form>
                <p className="auth-foot">
                    <LockKeyhole size={15} />
                    Invite-only access. Your administrator will send a password-setup link by email.
                </p>
            </div>
        </section>
    );
}
export function Join() { const { user } = useAuth(), { logoSrc } = useTheme(), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [token, setToken] = useState(''), [success, setSuccess] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false); if (user) return <Navigate to="/dashboard" replace />; async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { if (!sb) throw Error('Configure Supabase first.'); const { error: err } = await sb.auth.signUp({ email, password, options: { data: { invite_code: token.trim() }, emailRedirectTo: window.location.origin + '/login' } }); if (err) throw err; setSuccess('Account created. Check your inbox to confirm your email, then log in.') } catch (e) { setError(errorText(e)) } finally { setBusy(false) } } return <section className="auth-screen"><div className="auth-panel"><img src={logoSrc} alt="Kiducatchis" /><span className="eyebrow">// MEMBER ACTIVATION</span><h1>JOIN THE <em>TRIBE.</em></h1><p>Only people invited by the administrator can register.</p><form className="form-stack" onSubmit={submit}><label>Invited email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Invite code<input required value={token} onChange={e=>setToken(e.target.value)}/></label><label>Set a password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><Flash error={error} success={success}/><button className="btn btn-primary" disabled={busy}>{busy?'CREATING...':'ACTIVATE ACCOUNT'} <ArrowRight size={17}/></button></form><p className="auth-foot">Already registered? <Link to="/login">Sign in</Link></p></div></section>}