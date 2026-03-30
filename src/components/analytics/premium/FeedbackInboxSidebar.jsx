import React from 'react';

// Common platform icons modeled off the mockup
const PlatformIcon = ({ type }) => {
    switch (type) {
        case 'zendesk':
            return (
                <div className="w-5 h-5 flex items-center justify-center bg-black rounded text-white text-[10px] font-bold">
                    Z
                </div>
            );
        case 'horizon':
            return (
                <div className="w-5 h-5 flex items-center justify-center bg-[#43b0f1] rounded-full text-white text-[10px] font-bold">
                    H
                </div>
            );
        case 'appstore':
            return (
                <div className="w-5 h-5 flex items-center justify-center bg-blue-500 rounded text-white text-[10px] font-bold">
                    A
                </div>
            );
        case 'playstore':
            return (
                <div className="w-5 h-5 flex items-center justify-center bg-green-500 rounded text-white text-[10px] font-bold">
                    P
                </div>
            );
        default:
            return (
                <div className="w-5 h-5 flex items-center justify-center bg-gray-200 rounded text-gray-500 text-[10px] font-bold">
                    ?
                </div>
            );
    }
};

const FeedbackInboxSidebar = ({ items }) => {
    const [activeIndex, setActiveIndex] = React.useState(0);

    const inboxData = items && items.length > 0
        ? items.slice(0, 50).map((review, i) => {
            const idStr = String(review.id || `u${i}`);
            return {
                id: review.id,
                name: `User ${idStr.substring(0, 4)}`,
                initials: "U",
                avatar: null,
                platform: String(review.source || 'horizon').toLowerCase(),
                snippet: review.content,
                active: i === activeIndex
            };
        })
        : [
            {
                name: "Lisa James",
                initials: "LJ",
                avatar: null,
                platform: "horizon",
                snippet: "Love the dress, but the size chart was confusing...",
                active: 0 === activeIndex
            }
        ];

    // Simple avatar color generator based on name
    const getAvatarColor = (name) => {
        const colors = [
            'bg-blue-100 text-blue-700',
            'bg-green-100 text-green-700',
            'bg-purple-100 text-purple-700',
            'bg-orange-100 text-orange-700',
            'bg-pink-100 text-pink-700'
        ];
        const index = name.length % colors.length;
        return colors[index];
    };

    return (
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-800 tracking-wide">Inbox</h3>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {inboxData.map((item, idx) => (
                    <div
                        key={idx}
                        onClick={() => setActiveIndex(idx)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${item.active
                            ? 'bg-white border-rose-200 shadow-[0_2px_10px_-3px_rgba(244,63,94,0.2)]'
                            : 'bg-gray-50/50 border-transparent hover:bg-gray-50 hover:border-gray-200'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${getAvatarColor(item.name)}`}>
                                    {item.initials}
                                </div>

                                <div>
                                    <h4 className="text-[13px] font-bold text-gray-800">{item.name}</h4>

                                    {/* Mock rating/stars for non-active items to match design */}
                                    {!item.active && (
                                        <div className="flex gap-0.5 mt-0.5">
                                            <div className="w-8 h-1 bg-gray-200 rounded-full" />
                                            <div className="w-8 h-1 bg-gray-200 rounded-full" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <PlatformIcon type={item.platform} />
                        </div>

                        {item.active && (
                            <p className="mt-3 text-[13px] text-gray-600 leading-relaxed font-medium pl-1">
                                {item.snippet}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FeedbackInboxSidebar;
