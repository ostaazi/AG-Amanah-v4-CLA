import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserRole } from '../types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    userRole: UserRole;
    allowedRoles: UserRole[];
    redirectPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    userRole,
    allowedRoles,
    redirectPath = '/',
}) => {
    if (!allowedRoles.includes(userRole)) {
        return <Navigate to={redirectPath} replace />;
    }

    return <>{children}</>;
};
