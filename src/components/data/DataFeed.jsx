import { apiFetch } from '../../utils/api';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = '';

const DataFeed = () => {
    const [reviews, setReviews] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const limit = 20;

    const fetchFeed = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                limit: limit.toString(),
                offset: (page * limit).toString(),
            });
            if (search) query.append('search', search);

            const res = await apiFetch(`${API_BASE}/api/data/feed?${query}`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data.data);
                setTotal(data.total);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, search, limit]);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(0); // Reset to first page
        fetchFeed();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900">Review Data Feed</h3>
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search reviews..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">
                        Filter
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">Loading data...</td>
                                </tr>
                            ) : reviews.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">No reviews found.</td>
                                </tr>
                            ) : (
                                reviews.map((review, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {review.at ? new Date(review.at).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            {review.score} / 5
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                                            {review.content}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${review.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                                    review.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'}`}>
                                                {review.sentiment || 'neutral'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {review.pain_point_category || 'Other'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                            Previous
                        </button>
                        <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= total} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{page * limit + 1}</span> to <span className="font-medium">{Math.min((page + 1) * limit, total)}</span> of <span className="font-medium">{total}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(Math.max(0, page - 1))}
                                    disabled={page === 0}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <span className="sr-only">Previous</span>
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setPage(page + 1)}
                                    disabled={(page + 1) * limit >= total}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <span className="sr-only">Next</span>
                                    <ChevronRight size={16} />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataFeed;
