import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Search, ShieldCheck, Users, UserPlus } from 'lucide-react';
import { sb, errorText, fileUrl, isCore } from './lib.js';
import { useAuth } from './App.jsx';

export default function SquadManager() {
    const { profile } = useAuth();
    const [players, setPlayers] = useState([]);
    const [search, setSearch] = useState('');
    const [view, setView] = useState('all');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            try {
                const { data, error } = await sb.from('profiles')
                    .select('id,full_name,position,jersey_number,avatar_path,is_active,in_squad,role')
                    .eq('role', 'player')
                    .order('full_name');
                if (error) throw error;
                if (active) setPlayers(data || []);
            } catch (e) {
                if (active) setError(errorText(e));
            } finally {
                if (active) setLoading(false);
            }
        }
        if (sb && isCore(profile)) load();
        else setLoading(false);
        return () => { active = false; };
    }, [profile?.id, profile?.role, profile?.is_active]);

    const selected = players.filter(p => p.in_squad && p.is_active).length;
    const filtered = useMemo(() => players.filter(p => {
        const matchesName = p.full_name.toLowerCase().includes(search.trim().toLowerCase());
        const matchesView = view === 'all' ||
            (view === 'squad' && p.in_squad && p.is_active) ||
            (view === 'available' && !p.in_squad && p.is_active);
        return matchesName && matchesView;
    }), [players, search, view]);

    async function toggle(player) {
        if (!isCore(profile) || busyId) return;
        setBusyId(player.id);
        setError('');
        try {
            const { error } = await sb.rpc('core_set_squad_player', {
                p_player_id: player.id,
                p_in_squad: !player.in_squad
            });
            if (error) throw error;
            setPlayers(items => items.map(p =>
                p.id === player.id ? { ...p, in_squad: !player.in_squad } : p
            ));
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusyId(null);
        }
    }

    if (!isCore(profile)) return <p>You do not have permission to manage the squad.</p>;

    return (
        <>
            <div className="dash-heading">
                <span className="eyebrow">// CLUB SELECTION</span>
                <h1>SQUAD SELECTION</h1>
                <p>Admin and Council can choose the public squad from existing player records.</p>
            </div>

            <div className="squad-manage-stats">
                <div><Users size={19} /><strong>{players.length}</strong><span>REGISTERED PLAYERS</span></div>
                <div><ShieldCheck size={19} /><strong>{selected}</strong><span>SELECTED FOR SQUAD</span></div>
                <div><UserPlus size={19} /><strong>{players.filter(p => p.is_active && !p.in_squad).length}</strong><span>AVAILABLE PLAYERS</span></div>
            </div>

            <section className="dash-panel">
                <div className="squad-manage-toolbar">
                    <div className="squad-search"><Search size={18} /><input aria-label="Search player" placeholder="Search players by name" value={search} onChange={e => setSearch(e.target.value)} /></div>
                    <select aria-label="Filter squad" value={view} onChange={e => setView(e.target.value)}>
                        <option value="all">All players</option>
                        <option value="squad">Selected squad</option>
                        <option value="available">Available players</option>
                    </select>
                </div>
                {error && <p className="flash error" role="alert">{error}</p>}
                {loading ? <p className="small-note">Loading players…</p> : filtered.length === 0 ?
                    <p className="small-note">No players match this filter. Admins can add player records in Members & Squad.</p> :
                    <div className="squad-manage-list">
                        {filtered.map(player => (
                            <div className="squad-manage-row" key={player.id}>
                                <div className="mini-avatar">
                                    {player.avatar_path ? <img src={fileUrl('club-media', player.avatar_path)} alt="" /> : (player.full_name?.[0] || 'P')}
                                </div>
                                <div className="squad-manage-info">
                                    <Link to={`/profile/${player.id}`}><b>{player.full_name}</b></Link>
                                    <small>#{player.jersey_number ?? '—'} · {player.position} · {!player.is_active ? 'Inactive' : player.in_squad ? 'Selected squad' : 'Player pool'}</small>
                                </div>
                                <button
                                    type="button"
                                    className={'small-btn ' + (player.in_squad ? 'squad-remove' : 'squad-add')}
                                    aria-pressed={Boolean(player.in_squad)}
                                    onClick={() => toggle(player)}
                                    disabled={Boolean(busyId) || (!player.is_active && !player.in_squad)}
                                >
                                    {player.in_squad ? <><Check size={15} /> SELECTED — REMOVE</> : <><UserPlus size={15} /> ADD TO SQUAD</>}
                                </button>
                            </div>
                        ))}
                    </div>
                }
                <p className="small-note">Changes save immediately. Removing someone from the public squad does not erase tournament history or match statistics.</p>
            </section>
        </>
    );
}
